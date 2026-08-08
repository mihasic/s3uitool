import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/** AWS error codes that mean "the thing you asked for isn't there". */
const NOT_FOUND_MESSAGES: Record<string, string> = {
  NoSuchBucket: "Bucket not found",
  NoSuchKey: "Object not found",
  NotFound: "Not found",
  QueueDoesNotExist: "Queue not found",
  // ElasticMQ and other emulators may still answer with the query-protocol code.
  "AWS.SimpleQueueService.NonExistentQueue": "Queue not found",
};
const AUTH_ERROR_CODES = new Set(["InvalidAccessKeyId", "SignatureDoesNotMatch"]);

/** Every SDK v3 service exception carries `$metadata`; the wire code lands on `name`. */
function awsErrorCode(err: unknown): string | undefined {
  if (err instanceof Error && typeof (err as { $metadata?: unknown }).$metadata === "object") return err.name;
  return undefined;
}

/**
 * Turn anything thrown by a route into `{ error: "<sentence>" }`, which is what
 * the frontend's `ApiError` reads. AWS failures become 404 or 502; the rest 500.
 */
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
