import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/** AWS codes that mean the thing isn't there. */
const NOT_FOUND_MESSAGES: Record<string, string> = {
  NoSuchBucket: "Bucket not found",
  NoSuchKey: "Object not found",
  NotFound: "Not found",
  QueueDoesNotExist: "Queue not found",
  // Emulators may still answer with the query-protocol code.
  "AWS.SimpleQueueService.NonExistentQueue": "Queue not found",
};
const AUTH_ERROR_CODES = new Set(["InvalidAccessKeyId", "SignatureDoesNotMatch"]);

/** SDK exceptions carry `$metadata`; the wire code lands on `name`. */
function awsErrorCode(err: unknown): string | undefined {
  if (err instanceof Error && typeof (err as { $metadata?: unknown }).$metadata === "object") return err.name;
  return undefined;
}

/** Anything thrown becomes `{ error }`, which the frontend's `ApiError` reads. */
export function onError(err: Error, c: Context): Response {
  if (err instanceof HTTPException) return c.json({ error: err.message || "Request failed" }, err.status);

  const code = awsErrorCode(err);
  if (code !== undefined) {
    const notFound = NOT_FOUND_MESSAGES[code];
    if (notFound) return c.json({ error: notFound }, 404);
    if (AUTH_ERROR_CODES.has(code)) {
      return c.json({ error: "AWS authentication failed. Check endpoint and credentials." }, 502);
    }
    return c.json({ error: `AWS request failed: ${code}` }, 502);
  }

  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: "Internal server error" }, 500);
}
