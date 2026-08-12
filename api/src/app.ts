import { statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { settings } from "./config";
import { corsMiddleware } from "./cors";
import { onError } from "./errors";
import { s3Routes } from "./s3";
import { sqsRoutes } from "./sqs";
import { resolveStaticFile } from "./static";

// Checked per-request, so running without a bundled frontend (dev) still works.
const STATIC_DIR = process.env.STATIC_DIR ?? "/app/static";

export const app = new Hono();

app.use("*", corsMiddleware);

app.onError(onError);

if (settings.enableS3) app.route("/api/s3", s3Routes);
if (settings.enableSqs) app.route("/api/sqs", sqsRoutes);

app.get("/api/config", (c) => c.json({ s3: settings.enableS3, sqs: settings.enableSqs }));

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.get("/*", (c) => {
  const path = decodeURIComponent(c.req.path).replace(/^\//, "");
  if (path.startsWith("api/")) return c.json({ error: "Not found" }, 404);

  const index = join(STATIC_DIR, "index.html");
  if (!statSync(index, { throwIfNoEntry: false })?.isFile()) return c.json({ error: "Not found" }, 404);

  // Unknown paths fall back to index.html for the SPA router.
  const file = Bun.file(resolveStaticFile(STATIC_DIR, path) ?? index);
  // `new Response(BunFile)` sets no Content-Type; module scripts need one.
  return new Response(file, { headers: { "Content-Type": file.type } });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));
