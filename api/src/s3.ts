import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandInput,
  type S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Hono } from "hono";
import { lookup as lookupMime } from "mime-types";
import { getS3Client } from "./aws.ts";
import { httpError } from "./errors.ts";
import { contentDisposition, isoUtc } from "./serialize.ts";
import { zipStream } from "./zip.ts";

const S3_DELETE_BATCH_SIZE = 1000;
const BATCH_CONCURRENCY = 10;

type S3Object = {
  Key: string;
  LastModified: string | null;
  ETag: string;
  Size: number;
  StorageClass: string | null;
};

type ObjectList = {
  Objects: S3Object[];
  CommonPrefixes: { Prefix: string }[];
  Prefix: string;
  NextContinuationToken: string | null;
  IsTruncated: boolean;
};

type PrefixParams = {
  prefix: string;
  continuation_token?: string | null;
  max_keys?: number;
  filter_text?: string | null;
  delimiter?: string;
};

export const s3Routes = new Hono();

/** Yield every object key under `prefix` across all pages. */
async function* allObjectKeys(s3: S3Client, bucket: string, prefix: string): AsyncGenerator<string> {
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const obj of page.Contents ?? []) {
      if (obj.Key !== undefined) yield obj.Key;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

/** Project a raw SDK object onto the fields FastAPI's `S3Object` response model exposes. */
function toS3Object(obj: {
  Key?: string;
  LastModified?: Date;
  ETag?: string;
  Size?: number;
  StorageClass?: string;
}): S3Object {
  return {
    Key: obj.Key ?? "",
    LastModified: isoUtc(obj.LastModified),
    ETag: obj.ETag ?? "",
    Size: obj.Size ?? 0,
    StorageClass: obj.StorageClass ?? null,
  };
}

async function fetchObjects(
  s3: S3Client,
  bucket: string,
  prefix: string,
  continuationToken?: string | null,
  maxKeys = 1000,
  filterText?: string | null,
  delimiter = "/",
): Promise<ObjectList> {
  let s3Prefix = prefix;
  if (filterText) s3Prefix += filterText;

  const input: ListObjectsV2CommandInput = {
    Bucket: bucket,
    Prefix: s3Prefix,
    Delimiter: delimiter,
    MaxKeys: maxKeys,
  };
  if (continuationToken) input.ContinuationToken = continuationToken;

  const response = await s3.send(new ListObjectsV2Command(input));

  const objects: S3Object[] = [];
  for (const obj of response.Contents ?? []) {
    // Skip the folder itself if it appears in contents
    if (obj.Key === prefix && prefix !== "") continue;
    objects.push(toS3Object(obj));
  }

  return {
    Objects: objects,
    CommonPrefixes: (response.CommonPrefixes ?? []).map((p) => ({ Prefix: p.Prefix ?? "" })),
    Prefix: prefix,
    NextContinuationToken: response.NextContinuationToken ?? null,
    IsTruncated: response.IsTruncated ?? false,
  };
}

/** Query-param coercion that mimics FastAPI's 422 on a non-integer value. */
function intParam(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  if (!/^-?\d+$/.test(raw.trim())) {
    throw httpError(422, [
      {
        type: "int_parsing",
        loc: ["query", "max_keys"],
        msg: "Input should be a valid integer, unable to parse string as an integer",
        input: raw,
      },
    ]);
  }
  return Number.parseInt(raw, 10);
}

/** Bound parallelism the way `ThreadPoolExecutor(max_workers=10)` does. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

s3Routes.get("/buckets", async (c) => {
  const response = await getS3Client().send(new ListBucketsCommand({}));
  return c.json((response.Buckets ?? []).map((b) => ({ Name: b.Name ?? "", CreationDate: isoUtc(b.CreationDate) })));
});

s3Routes.get("/buckets/:bucket/objects", async (c) => {
  const q = c.req.query();
  return c.json(
    await fetchObjects(
      getS3Client(),
      c.req.param("bucket"),
      q.prefix ?? "",
      q.continuation_token ?? null,
      intParam(q.max_keys, 1000),
      q.filter_text ?? null,
      q.delimiter ?? "/",
    ),
  );
});

s3Routes.post("/buckets/:bucket/objects/batch", async (c) => {
  const bucket = c.req.param("bucket");
  const body = await c.req.json<{ prefixes?: string[]; requests?: PrefixParams[] }>();
  const s3 = getS3Client();

  const jobs: { prefix: string; run: () => Promise<ObjectList> }[] = [
    // Legacy simple prefixes list
    ...(body.prefixes ?? []).map((p) => ({ prefix: p, run: () => fetchObjects(s3, bucket, p) })),
    // Newer complex requests
    ...(body.requests ?? []).map((r) => ({
      prefix: r.prefix,
      run: () =>
        fetchObjects(s3, bucket, r.prefix, r.continuation_token, r.max_keys ?? 1000, r.filter_text, r.delimiter ?? "/"),
    })),
  ];

  const results: Record<string, ObjectList> = {};
  const settled = await mapWithConcurrency(jobs, BATCH_CONCURRENCY, async (job) => {
    try {
      return { prefix: job.prefix, value: await job.run() };
    } catch (e) {
      // Return an empty result for this prefix rather than failing the whole batch.
      console.warn(`Error fetching prefix ${job.prefix}: ${e}`);
      return {
        prefix: job.prefix,
        value: {
          Objects: [],
          CommonPrefixes: [],
          Prefix: job.prefix,
          NextContinuationToken: null,
          IsTruncated: false,
        } satisfies ObjectList,
      };
    }
  });
  for (const { prefix, value } of settled) results[prefix] = value;

  return c.json(results);
});

s3Routes.get("/buckets/:bucket/objects/:key{.+}", async (c) => {
  const bucket = c.req.param("bucket");
  const key = c.req.param("key");
  const s3 = getS3Client();

  // Get metadata first
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

  let content: string | null = null;
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    content = null; // Binary content
  }

  return c.json({
    Key: key,
    LastModified: isoUtc(head.LastModified),
    ETag: head.ETag ?? "",
    Size: head.ContentLength ?? 0,
    StorageClass: head.StorageClass ?? null,
    ContentType: head.ContentType ?? null,
    Metadata: head.Metadata ?? null,
    Content: content,
  });
});

s3Routes.get("/buckets/:bucket/download/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const response = await getS3Client().send(new GetObjectCommand({ Bucket: c.req.param("bucket"), Key: key }));

  let contentType = response.ContentType || "application/octet-stream";
  // If generic or missing, try to guess from filename
  if (contentType === "application/octet-stream") {
    const guessed = lookupMime(key);
    if (guessed) contentType = guessed;
  }

  // Starlette appends a charset to textual media types.
  if (contentType.startsWith("text/") && !contentType.includes("charset=")) contentType += "; charset=utf-8";

  const disposition = c.req.query("inline") === "true" ? "inline" : "attachment";
  return new Response(response.Body?.transformToWebStream(), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(disposition, key.split("/").pop() ?? key),
      ...(response.ContentLength !== undefined ? { "Content-Length": String(response.ContentLength) } : {}),
    },
  });
});

s3Routes.put("/buckets/:bucket/objects/:key{.+}", async (c) => {
  const bucket = c.req.param("bucket");
  const key = c.req.param("key");
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw httpError(422, [{ type: "missing", loc: ["body", "file"], msg: "Field required", input: null }]);
  }

  const contentType = file.type || lookupMime(key) || undefined;
  await new Upload({
    client: getS3Client(),
    params: { Bucket: bucket, Key: key, Body: file, ...(contentType ? { ContentType: contentType } : {}) },
  }).done();

  return c.json({ message: "File uploaded successfully" });
});

s3Routes.delete("/buckets/:bucket/objects/:key{.+}", async (c) => {
  await getS3Client().send(new DeleteObjectCommand({ Bucket: c.req.param("bucket"), Key: c.req.param("key") }));
  return c.json({ message: "Object deleted successfully" });
});

s3Routes.post("/buckets/:bucket/delete-prefix", async (c) => {
  const bucket = c.req.param("bucket");
  const { prefix } = await c.req.json<{ prefix: string }>();
  const s3 = getS3Client();

  const keys: { Key: string }[] = [];
  for await (const key of allObjectKeys(s3, bucket, prefix)) keys.push({ Key: key });

  // Delete in batches (S3 limit)
  for (let i = 0; i < keys.length; i += S3_DELETE_BATCH_SIZE) {
    await s3.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.slice(i, i + S3_DELETE_BATCH_SIZE) } }),
    );
  }

  return c.json({ message: `Deleted ${keys.length} objects` });
});

/** `CopySource` is a raw path that must be percent-encoded per segment. */
function copySource(bucket: string, key: string): string {
  return `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

s3Routes.post("/copy", async (c) => {
  const req = await c.req.json<{
    source_bucket: string;
    source_key: string;
    destination_bucket: string;
    destination_key: string;
    move?: boolean;
  }>();
  const s3 = getS3Client();

  await s3.send(
    new CopyObjectCommand({
      Bucket: req.destination_bucket,
      Key: req.destination_key,
      CopySource: copySource(req.source_bucket, req.source_key),
    }),
  );

  if (req.move) {
    await s3.send(new DeleteObjectCommand({ Bucket: req.source_bucket, Key: req.source_key }));
    return c.json({ message: "Object moved successfully" });
  }

  return c.json({ message: "Object copied successfully" });
});

s3Routes.post("/copy-prefix", async (c) => {
  const req = await c.req.json<{
    source_bucket: string;
    source_prefix: string;
    destination_bucket: string;
    destination_prefix: string;
    move?: boolean;
  }>();
  const s3 = getS3Client();

  let count = 0;
  for await (const srcKey of allObjectKeys(s3, req.source_bucket, req.source_prefix)) {
    if (!srcKey.startsWith(req.source_prefix)) continue;
    const destKey = req.destination_prefix + srcKey.slice(req.source_prefix.length);

    await s3.send(
      new CopyObjectCommand({
        Bucket: req.destination_bucket,
        Key: destKey,
        CopySource: copySource(req.source_bucket, srcKey),
      }),
    );

    if (req.move) await s3.send(new DeleteObjectCommand({ Bucket: req.source_bucket, Key: srcKey }));

    count += 1;
  }

  return c.json({ message: `Successfully ${req.move ? "moved" : "copied"} ${count} objects` });
});

s3Routes.get("/buckets/:bucket/download-prefix", async (c) => {
  const bucket = c.req.param("bucket");
  const prefix = c.req.query("prefix") ?? "";
  const s3 = getS3Client();

  async function* entries(): AsyncGenerator<{ name: string; data: Uint8Array }> {
    for await (const key of allObjectKeys(s3, bucket, prefix)) {
      if (key.endsWith("/")) continue;
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const data = (await obj.Body?.transformToByteArray()) ?? new Uint8Array();

        let arcname = key.startsWith(prefix) ? key.slice(prefix.length) : key;
        if (arcname.startsWith("/")) arcname = arcname.slice(1);
        if (!arcname) arcname = key.split("/").pop() ?? key;

        yield { name: arcname, data };
      } catch (e) {
        console.warn(`Error zipping ${key}: ${e}`);
      }
    }
  }

  let filename = `${prefix.replace(/\/+$/, "").split("/").pop() ?? ""}.zip`;
  if (filename === ".zip") filename = "download.zip";

  return new Response(zipStream(entries()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition("attachment", filename),
    },
  });
});
