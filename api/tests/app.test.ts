import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "../src/app.ts";
import { contentDisposition, isoUtc } from "../src/serialize.ts";
import { resolveStaticFile } from "../src/static.ts";

describe("app", () => {
  test("reports feature flags", async () => {
    const res = await app.request("/api/config");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ s3: true, sqs: true });
  });

  test("reports health", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("404s unknown api routes as JSON", async () => {
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: "Not Found" });
  });

  test("echoes the origin for credentialed CORS", async () => {
    const res = await app.request("/api/health", { headers: { Origin: "http://localhost:5173" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });
});

describe("static file resolution", () => {
  test("blocks traversal", () => {
    // realpath so the assertions survive macOS's /var → /private/var symlink.
    const base = realpathSync(mkdtempSync(join(tmpdir(), "static-")));
    mkdirSync(join(base, "static"));
    const staticDir = join(base, "static");
    writeFileSync(join(staticDir, "index.html"), "ok");
    writeFileSync(join(base, "secret.txt"), "top secret");

    // A real file inside the static dir resolves.
    expect(resolveStaticFile(staticDir, "index.html")).toBe(join(staticDir, "index.html"));
    // Traversal outside the static dir is rejected.
    expect(resolveStaticFile(staticDir, "../secret.txt")).toBeNull();
    expect(resolveStaticFile(staticDir, "../../etc/passwd")).toBeNull();
    expect(resolveStaticFile(staticDir, "/etc/passwd")).toBeNull();
    // Directories are not files.
    expect(resolveStaticFile(staticDir, ".")).toBeNull();
  });
});

describe("serialization", () => {
  test("formats UTC datetimes like pydantic", () => {
    expect(isoUtc(new Date("2026-08-08T12:00:00.000Z"))).toBe("2026-08-08T12:00:00Z");
    expect(isoUtc(new Date("2026-08-08T12:00:00.123Z"))).toBe("2026-08-08T12:00:00.123000Z");
    expect(isoUtc(undefined)).toBeNull();
  });

  test("builds RFC 5987 Content-Disposition values", () => {
    expect(contentDisposition("attachment", "plain.txt")).toBe(
      "attachment; filename=\"plain.txt\"; filename*=UTF-8''plain.txt",
    );
    expect(contentDisposition("inline", 'we"ird.txt')).toBe(
      "inline; filename=\"we'ird.txt\"; filename*=UTF-8''we%22ird.txt",
    );
    expect(contentDisposition("attachment", "ünïcode.txt")).toBe(
      "attachment; filename=\"?n?code.txt\"; filename*=UTF-8''%C3%BCn%C3%AFcode.txt",
    );
    expect(contentDisposition("attachment", "a b(1)!.txt")).toBe(
      "attachment; filename=\"a b(1)!.txt\"; filename*=UTF-8''a%20b%281%29%21.txt",
    );
  });
});
