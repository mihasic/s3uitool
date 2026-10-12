import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandInput,
  paginateListObjectsV2,
  type S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getS3Client } from "./aws";
import { type AppEnv, requireService } from "./context";
import { dateTime, nullable, respondWith, stringMap } from "./model";
import { type ZipEntry, zipStream } from "./zip";

const BATCH_CONCURRENCY = 10;

const bucketModel = z.object({
  Name: z.string().default(""),
  CreationDate: dateTime,
});

const s3ObjectModel = z.object({
  Key: z.string().default(""),
  LastModified: dateTime,
  ETag: z.string().default(""),
  Size: z.number().default(0),
  StorageClass: nullable(z.string()),
});

const s3ObjectContentModel = s3ObjectModel.extend({
  ContentType: nullable(z.string()),
  Metadata: nullable(stringMap),
  Content: nullable(z.string()),
});

const objectListModel = z.object({
  Objects: z.array(s3ObjectModel),
  CommonPrefixes: z.array(z.object({ Prefix: z.string().default("") })).default([]),
  Prefix: z.string(),
  NextContinuationToken: nullable(z.string()),
  IsTruncated: z.boolean().default(false),
});

const objectListBatchModel = z.record(z.string(), objectListModel);

type ObjectList = z.input<typeof objectListModel>;

type PrefixParams = {
  prefix: string;
  continuation_token?: string | null;
  max_keys?: number;
  filter_text?: string | null;
  delimiter?: string;
};

export const s3Routes = new Hono<AppEnv>();

s3Routes.use("*", requireService("s3", getS3Client));

async function* allObjectPages(s3: S3Client, bucket: string, prefix: string): AsyncGenerator<string[]> {
  for await (const page of paginateListObjectsV2({ client: s3 }, { Bucket: bucket, Prefix: prefix })) {
    yield (page.Contents ?? []).flatMap((obj) => (obj.Key === undefined ? [] : [obj.Key]));
  }
}

async function* allObjectKeys(s3: S3Client, bucket: string, prefix: string): AsyncGenerator<string> {
  for await (const page of allObjectPages(s3, bucket, prefix)) yield* page;
}

async function fetchObjects(
  s3: S3Client,
  bucket: string,
  { prefix, continuation_token, max_keys = 1000, filter_text, delimiter = "/" }: PrefixParams,
): Promise<ObjectList> {
  const input: ListObjectsV2CommandInput = {
    Bucket: bucket,
    Prefix: filter_text ? prefix + filter_text : prefix,
    Delimiter: delimiter,
    MaxKeys: max_keys,
  };
  if (continuation_token) input.ContinuationToken = continuation_token;

  const response = await s3.send(new ListObjectsV2Command(input));

  const objects: z.input<typeof s3ObjectModel>[] = [];
  for (const obj of response.Contents ?? []) {
    // Skip the folder itself if it appears in contents
    if (obj.Key === prefix && prefix !== "") continue;
    objects.push(obj);
  }

  return {
    Objects: objects,
    CommonPrefixes: response.CommonPrefixes,
    Prefix: prefix,
    NextContinuationToken: response.NextContinuationToken,
    IsTruncated: response.IsTruncated,
  };
}

/** RFC 5987: survives quotes and non-ASCII in keys. */
function contentDisposition(disposition: string, filename: string): string {
  // Browsers prefer `filename*`; `filename` is the ASCII fallback.
  const ascii = filename.replace(/[^\x20-\x7e]/g, "?").replaceAll('"', "'");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Non-numeric falls back rather than failing the request. */
function intParam(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Bound how many prefix lookups are in flight at once. */
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
  const response = await c.get("s3").send(new ListBucketsCommand({}));
  return respondWith(z.array(bucketModel), response.Buckets ?? []);
});

s3Routes.get("/buckets/:bucket/objects", async (c) => {
  const q = c.req.query();
  return respondWith(
    objectListModel,
    await fetchObjects(c.get("s3"), c.req.param("bucket"), {
      prefix: q.prefix ?? "",
      continuation_token: q.continuation_token,
      max_keys: intParam(q.max_keys, 1000),
      filter_text: q.filter_text,
      delimiter: q.delimiter,
    }),
  );
});

s3Routes.post("/buckets/:bucket/objects/batch", async (c) => {
  const bucket = c.req.param("bucket");
  const body = await c.req.json<{ requests?: PrefixParams[] }>();
  const s3 = c.get("s3");

  const jobs = (body.requests ?? []).map((r) => ({ prefix: r.prefix, run: () => fetchObjects(s3, bucket, r) }));

  const results: Record<string, ObjectList> = {};
  const settled = await mapWithConcurrency(jobs, BATCH_CONCURRENCY, async (job) => {
    try {
      return { prefix: job.prefix, value: await job.run() };
    } catch (e) {
      // One bad prefix must not fail the batch.
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

  return respondWith(objectListBatchModel, results);
});

s3Routes.get("/buckets/:bucket/objects/:key{.+}", async (c) => {
  const bucket = c.req.param("bucket");
  const key = c.req.param("key");
  const s3 = c.get("s3");

  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  let content: string | null = null;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(await obj.Body?.transformToByteArray());
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
  }

  return respondWith(s3ObjectContentModel, {
    Key: key,
    LastModified: obj.LastModified,
    ETag: obj.ETag,
    Size: obj.ContentLength,
    StorageClass: obj.StorageClass,
    ContentType: obj.ContentType,
    Metadata: obj.Metadata,
    Content: content,
  });
});

s3Routes.get("/buckets/:bucket/download/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const response = await c.get("s3").send(new GetObjectCommand({ Bucket: c.req.param("bucket"), Key: key }));

  let contentType = response.ContentType || "application/octet-stream";
  // If generic or missing, try to guess from filename
  if (contentType === "application/octet-stream") contentType = Bun.file(key).type;
  // Without a charset, `?inline=true` previews of UTF-8 text render as mojibake.
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
  if (!(file instanceof File)) return c.json({ error: "Expected a multipart body with a `file` field" }, 400);

  const contentType = file.type || Bun.file(key).type;
  await new Upload({
    client: c.get("s3"),
    params: { Bucket: bucket, Key: key, Body: file, ContentType: contentType },
  }).done();

  return c.json({ message: "File uploaded successfully" });
});

s3Routes.delete("/buckets/:bucket/objects/:key{.+}", async (c) => {
  await c.get("s3").send(new DeleteObjectCommand({ Bucket: c.req.param("bucket"), Key: c.req.param("key") }));
  return c.json({ message: "Object deleted successfully" });
});

s3Routes.post("/buckets/:bucket/delete-prefix", async (c) => {
  const bucket = c.req.param("bucket");
  const { prefix } = await c.req.json<{ prefix: unknown }>();
  if (typeof prefix !== "string") throw new HTTPException(400, { message: "Expected a string `prefix`" });
  const s3 = c.get("s3");

  let count = 0;
  for await (const keys of allObjectPages(s3, bucket, prefix)) {
    if (keys.length === 0) continue;
    await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }));
    count += keys.length;
  }

  return c.json({ message: `Deleted ${count} objects` });
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
  const s3 = c.get("s3");

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
  const s3 = c.get("s3");

  let count = 0;
  for await (const page of allObjectPages(s3, req.source_bucket, req.source_prefix)) {
    const keys = page.filter((key) => key.startsWith(req.source_prefix));
    await mapWithConcurrency(keys, BATCH_CONCURRENCY, (srcKey) =>
      s3.send(
        new CopyObjectCommand({
          Bucket: req.destination_bucket,
          Key: req.destination_prefix + srcKey.slice(req.source_prefix.length),
          CopySource: copySource(req.source_bucket, srcKey),
        }),
      ),
    );
    if (req.move && keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({ Bucket: req.source_bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }),
      );
    }
    count += keys.length;
  }

  return c.json({ message: `Successfully ${req.move ? "moved" : "copied"} ${count} objects` });
});

s3Routes.get("/buckets/:bucket/download-prefix", async (c) => {
  const bucket = c.req.param("bucket");
  const prefix = c.req.query("prefix") ?? "";
  const s3 = c.get("s3");

  async function* entries(): AsyncGenerator<ZipEntry> {
    for await (const key of allObjectKeys(s3, bucket, prefix)) {
      if (key.endsWith("/")) continue;

      // Guard the lookup only: once bytes flow, a failure must surface.
      let body: ReadableStream<Uint8Array> | undefined;
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        body = obj.Body?.transformToWebStream();
      } catch (e) {
        console.warn(`Error zipping ${key}: ${e}`);
        continue;
      }
      if (!body) continue;

      let arcname = key.startsWith(prefix) ? key.slice(prefix.length) : key;
      if (arcname.startsWith("/")) arcname = arcname.slice(1);
      if (!arcname) arcname = key.split("/").pop() ?? key;

      yield { name: arcname, data: body };
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
