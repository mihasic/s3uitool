import { statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { settings } from "./config.ts";
import { onError } from "./errors.ts";
import { s3Routes } from "./s3.ts";
import { sqsRoutes } from "./sqs.ts";
import { resolveStaticFile } from "./static.ts";

// Serve the built frontend (Production/Docker). The route is always registered and
// existence is checked per-request, so it's robust to the static dir not being ready
// at import time and to running without a bundled frontend (e.g. dev, where Vite serves it).
const STATIC_DIR = process.env.STATIC_DIR ?? "/app/static";

export const app = new Hono();

// The UI is same-origin in production and behind Vite's proxy in dev; this only
// matters when someone points VITE_API_URL at a different host.
app.use("*", cors({ origin: (origin) => origin, credentials: true }));

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

  // Unknown paths fall back to index.html so the SPA router can handle them.
  const file = Bun.file(resolveStaticFile(STATIC_DIR, path) ?? index);
  // `new Response(BunFile)` does not set a Content-Type, and browsers refuse to
  // execute a module script served without one.
  return new Response(file, { headers: { "Content-Type": file.type } });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));
