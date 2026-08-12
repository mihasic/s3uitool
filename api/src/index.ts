import { app } from "./app";

const port = Number(process.env.PORT ?? 8000);

// Bun buffers multipart bodies in memory, so this is also the per-upload memory cost.
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 512);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
  // Bun's default 10s idle timeout would abort slow uploads/downloads.
  idleTimeout: 255,
  maxRequestBodySize: maxUploadMb * 1024 * 1024,
};
