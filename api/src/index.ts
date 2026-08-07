import { app } from "./app.ts";

const port = Number(process.env.PORT ?? 8000);

// Bun buffers a multipart body in memory (Starlette spooled it to disk), so the cap
// is also the per-upload memory cost. 128 MiB is Bun's default; raise it for this
// tool but keep it tunable so a small container can't be OOM'd by a huge upload.
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 512);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
  // Bun's default 10s idle timeout would abort slow uploads/downloads; uvicorn has none.
  idleTimeout: 255,
  maxRequestBodySize: maxUploadMb * 1024 * 1024,
};
