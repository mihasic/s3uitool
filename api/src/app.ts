import { statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { settings } from "./config.ts";
import { cors } from "./cors.ts";
import { detailResponse, httpError, onError } from "./errors.ts";
import { s3Routes } from "./s3.ts";
import { sqsRoutes } from "./sqs.ts";
import { resolveStaticFile } from "./static.ts";

// Serve the built frontend (Production/Docker). The route is always registered and
// existence is checked per-request, so it's robust to the static dir not being ready
// at import time and to running without a bundled frontend (e.g. dev, where Vite serves it).
const STATIC_DIR = process.env.STATIC_DIR ?? "/app/static";

export const app = new Hono();

app.use("*", cors);

app.onError(onError);

if (settings.enableS3) app.route("/api/s3", s3Routes);
if (settings.enableSqs) app.route("/api/sqs", sqsRoutes);

app.get("/api/config", (c) => c.json({ s3: settings.enableS3, sqs: settings.enableSqs }));

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.get("/*", (c) => {
  const fullPath = decodeURIComponent(c.req.path).replace(/^\//, "");
  if (/^(api\/|docs|redoc|openapi\.json)/.test(fullPath)) throw httpError(404, "Not Found");

  const index = join(STATIC_DIR, "index.html");
  if (!statSync(index, { throwIfNoEntry: false })?.isFile()) throw httpError(404, "Not Found");

  const target = resolveStaticFile(STATIC_DIR, fullPath) ?? index;
  const file = Bun.file(target);
  // Starlette's FileResponse formats the media type as `text/html; charset=utf-8`.
  return new Response(file, { headers: { "Content-Type": file.type.replace(/;(?=\S)/, "; ") } });
});

const OTHER_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

// Starlette answers 405 when a path is registered but the method is not; Hono's
// router only reports "no match", so probe the other methods before giving up.
app.notFound((c) => {
  for (const method of OTHER_METHODS) {
    if (method === c.req.method) continue;
    const [handlers] = app.router.match(method, c.req.path);
    if (handlers.length > 0) return detailResponse(405, "Method Not Allowed");
  }
  return detailResponse(404, "Not Found");
});
