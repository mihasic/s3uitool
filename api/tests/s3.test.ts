import { beforeAll, describe, expect, test } from "bun:test";
import { unzipSync } from "fflate";
import { app } from "../src/app";
import { resetRegistry } from "../src/profiles";

const BUCKET = "test-bucket-1";

async function put(key: string, content: string | Uint8Array, type = "text/plain"): Promise<Response> {
  const form = new FormData();
  form.append("file", new File([content], key.split("/").pop() as string, { type }));
  return app.request(`/api/s3/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`, { method: "PUT", body: form });
}

describe("s3", () => {
  test("serves the same account under the legacy and profile-scoped mounts", async () => {
    const legacy = await app.request("/api/s3/buckets");
    const scoped = await app.request("/api/default/s3/buckets");
    const alt = await app.request("/api/alt/s3/buckets");
    expect([legacy.status, scoped.status, alt.status]).toEqual([200, 200, 200]);
    const expected = await legacy.json();
    expect(await scoped.json()).toEqual(expected);
    expect(await alt.json()).toEqual(expected);
  });

  test("404s a profile with the service disabled", async () => {
    process.env.PROFILE_nos3_ACCESS_KEY_ID = "a";
    process.env.PROFILE_nos3_SECRET_ACCESS_KEY = "b";
    process.env.PROFILE_nos3_ENABLE_S3 = "false";
    resetRegistry();
    try {
      const res = await app.request("/api/nos3/s3/buckets");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'S3 is not enabled for profile "nos3"' });
    } finally {
      for (const key of ["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENABLE_S3"]) delete process.env[`PROFILE_nos3_${key}`];
      resetRegistry();
    }
  });

  test("lists buckets", async () => {
    const res = await app.request("/api/s3/buckets");
    expect(res.status).toBe(200);
    const buckets = (await res.json()) as { Name: string; CreationDate: string }[];
    expect(Array.isArray(buckets)).toBe(true);
    // We expect at least the test buckets created in setup
    expect(buckets.map((b) => b.Name)).toContain(BUCKET);
    expect(buckets[0]?.CreationDate).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  test("uploads, lists and reads back an object", async () => {
    const fileName = "hello.txt";
    const fileContent = "Hello World";

    const upload = await put(fileName, fileContent);
    expect(upload.status).toBe(200);
    expect(await upload.json()).toEqual({ message: "File uploaded successfully" });

    const list = await app.request(`/api/s3/buckets/${BUCKET}/objects`);
    expect(list.status).toBe(200);
    const data = (await list.json()) as { Objects: { Key: string; Size: number }[] };
    expect(data.Objects.some((o) => o.Key === fileName)).toBe(true);

    const get = await app.request(`/api/s3/buckets/${BUCKET}/objects/${fileName}`);
    expect(get.status).toBe(200);
    const obj = (await get.json()) as Record<string, unknown>;
    expect(obj.Content).toBe(fileContent);
    // Bun normalises `File#type` for text/* to include a charset; S3 stores it verbatim.
    expect(obj.ContentType).toStartWith("text/plain");
    expect(obj.Size).toBe(fileContent.length);
    expect(Object.keys(obj)).toEqual([
      "Key",
      "LastModified",
      "ETag",
      "Size",
      "StorageClass",
      "ContentType",
      "Metadata",
      "Content",
    ]);
  });

  test("returns 404 for a missing object", async () => {
    // A missing key maps to 404 via the central AWS error handler, not 500.
    const res = await app.request(`/api/s3/buckets/${BUCKET}/objects/does-not-exist.txt`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  test("returns 404 for a missing bucket", async () => {
    const res = await app.request("/api/s3/buckets/no-such-bucket-xyz/objects");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Bucket not found" });
  });

  test("reports binary content as null", async () => {
    const key = "binary/blob.bin";
    await put(key, new Uint8Array([0xff, 0xfe, 0x00, 0x80]), "application/octet-stream");
    const res = await app.request(`/api/s3/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { Content: unknown }).Content).toBeNull();
  });

  test("groups nested keys into common prefixes", async () => {
    await put("folder-a/one.txt", "1");
    await put("folder-a/two.txt", "2");

    const res = await app.request(`/api/s3/buckets/${BUCKET}/objects?prefix=folder-a/`);
    const data = (await res.json()) as { Objects: { Key: string }[]; Prefix: string };
    expect(data.Prefix).toBe("folder-a/");
    expect(data.Objects.map((o) => o.Key).sort()).toEqual(["folder-a/one.txt", "folder-a/two.txt"]);

    const root = (await (await app.request(`/api/s3/buckets/${BUCKET}/objects`)).json()) as {
      CommonPrefixes: { Prefix: string }[];
    };
    expect(root.CommonPrefixes.map((p) => p.Prefix)).toContain("folder-a/");
  });

  test("paginates with max_keys and a continuation token", async () => {
    const res = await app.request(`/api/s3/buckets/${BUCKET}/objects?max_keys=1&delimiter=`);
    const page = (await res.json()) as { Objects: unknown[]; IsTruncated: boolean; NextContinuationToken: string };
    expect(page.Objects).toHaveLength(1);
    expect(page.IsTruncated).toBe(true);

    const next = await app.request(
      `/api/s3/buckets/${BUCKET}/objects?max_keys=1&delimiter=&continuation_token=${encodeURIComponent(page.NextContinuationToken)}`,
    );
    const page2 = (await next.json()) as { Objects: { Key: string }[] };
    expect(page2.Objects).toHaveLength(1);
    expect(page2.Objects[0]?.Key).not.toBe((page.Objects[0] as { Key: string }).Key);
  });

  test("falls back to the default when max_keys is not a number", async () => {
    const res = await app.request(`/api/s3/buckets/${BUCKET}/objects?max_keys=abc`);
    expect(res.status).toBe(200);
  });

  test("resolves a batch of prefixes in one call", async () => {
    await put("folder-b/three.txt", "3");
    const res = await app.request(`/api/s3/buckets/${BUCKET}/objects/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ prefix: "folder-a/" }, { prefix: "folder-b/" }] }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, { Objects: { Key: string }[] }>;
    expect(Object.keys(data).sort()).toEqual(["folder-a/", "folder-b/"]);
    expect(data["folder-b/"]?.Objects.map((o) => o.Key)).toEqual(["folder-b/three.txt"]);
  });

  test("downloads an object with a safe Content-Disposition", async () => {
    const key = "folder-a/one.txt";
    const res = await app.request(`/api/s3/buckets/${BUCKET}/download/${encodeURIComponent(key)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe("attachment; filename=\"one.txt\"; filename*=UTF-8''one.txt");
    expect(await res.text()).toBe("1");

    const inline = await app.request(`/api/s3/buckets/${BUCKET}/download/${encodeURIComponent(key)}?inline=true`);
    expect(inline.headers.get("content-disposition")?.startsWith("inline;")).toBe(true);
    expect(inline.headers.get("content-type")).toStartWith("text/plain");
  });

  test("keeps quotes and non-ASCII out of the ASCII Content-Disposition fallback", async () => {
    const key = 'odd/wé"ird ünïcode.txt';
    await put(key, "x");
    const res = await app.request(`/api/s3/buckets/${BUCKET}/download/${encodeURIComponent(key)}`);
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="w?'ird ?n?code.txt"; filename*=UTF-8''${encodeURIComponent('wé"ird ünïcode.txt')}`,
    );
  });

  test("copies and moves objects", async () => {
    await put("copy-src/a.txt", "A");

    const copy = await app.request("/api/s3/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_bucket: BUCKET,
        source_key: "copy-src/a.txt",
        destination_bucket: "test-bucket-2",
        destination_key: "copy-dst/a.txt",
        move: false,
      }),
    });
    expect(await copy.json()).toEqual({ message: "Object copied successfully" });

    const copied = await app.request(`/api/s3/buckets/test-bucket-2/objects/${encodeURIComponent("copy-dst/a.txt")}`);
    expect(((await copied.json()) as { Content: string }).Content).toBe("A");

    const move = await app.request("/api/s3/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_bucket: BUCKET,
        source_key: "copy-src/a.txt",
        destination_bucket: BUCKET,
        destination_key: "copy-moved/a.txt",
        move: true,
      }),
    });
    expect(await move.json()).toEqual({ message: "Object moved successfully" });
    expect((await app.request(`/api/s3/buckets/${BUCKET}/objects/copy-src%2Fa.txt`)).status).toBe(404);
  });

  test("copies a whole prefix", async () => {
    await put("tree/x/1.txt", "1");
    await put("tree/y/2.txt", "2");

    const res = await app.request("/api/s3/copy-prefix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_bucket: BUCKET,
        source_prefix: "tree/",
        destination_bucket: BUCKET,
        destination_prefix: "tree-copy/",
        move: false,
      }),
    });
    expect(await res.json()).toEqual({ message: "Successfully copied 2 objects" });

    const listed = (await (
      await app.request(`/api/s3/buckets/${BUCKET}/objects?prefix=tree-copy/&delimiter=`)
    ).json()) as { Objects: { Key: string }[] };
    expect(listed.Objects.map((o) => o.Key).sort()).toEqual(["tree-copy/x/1.txt", "tree-copy/y/2.txt"]);
  });

  test("streams a prefix as a zip", async () => {
    const res = await app.request(`/api/s3/buckets/${BUCKET}/download-prefix?prefix=${encodeURIComponent("tree/")}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain('filename="tree.zip"');

    const archive = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(Object.keys(archive).sort()).toEqual(["x/1.txt", "y/2.txt"]);
    expect(new TextDecoder().decode(archive["x/1.txt"])).toBe("1");
  });

  test("deletes a single object", async () => {
    await put("gone.txt", "bye");
    const res = await app.request(`/api/s3/buckets/${BUCKET}/objects/gone.txt`, { method: "DELETE" });
    expect(await res.json()).toEqual({ message: "Object deleted successfully" });
    expect((await app.request(`/api/s3/buckets/${BUCKET}/objects/gone.txt`)).status).toBe(404);
  });

  test("deletes a whole prefix", async () => {
    await put("doomed/a.txt", "a");
    await put("doomed/b/c.txt", "c");

    const res = await app.request(`/api/s3/buckets/${BUCKET}/delete-prefix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "doomed/" }),
    });
    expect(await res.json()).toEqual({ message: "Deleted 2 objects" });

    const listed = (await (
      await app.request(`/api/s3/buckets/${BUCKET}/objects?prefix=doomed/&delimiter=`)
    ).json()) as { Objects: unknown[] };
    expect(listed.Objects).toHaveLength(0);
  });

  beforeAll(async () => {
    // Leftovers from a previous run would break the pagination assertions.
    await app.request(`/api/s3/buckets/${BUCKET}/delete-prefix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "" }),
    });
    await app.request("/api/s3/buckets/test-bucket-2/delete-prefix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "" }),
    });
  });
});
