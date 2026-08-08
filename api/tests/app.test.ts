import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "../src/app.ts";
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
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  test("serves the SPA index with a usable Content-Type", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    // Browsers refuse to execute module scripts served without a MIME type.
    expect(res.headers.get("content-type")).toStartWith("text/html");
    expect(await res.text()).toContain("<title>app</title>");
  });

  test("serves static assets and falls back to the index for SPA routes", async () => {
    const asset = await app.request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toStartWith("text/javascript");

    const spaRoute = await app.request("/s3/documents");
    expect(spaRoute.status).toBe(200);
    expect(await spaRoute.text()).toContain("<title>app</title>");
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
