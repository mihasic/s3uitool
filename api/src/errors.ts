import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

// Map known AWS error codes to friendly 404 messages; everything else is a 502.
// The JS SDK models some of these as typed exceptions whose `name` differs from
// the wire error code botocore surfaces, so both spellings are listed.
const NOT_FOUND_MESSAGES: Record<string, string> = {
  NoSuchBucket: "Bucket not found",
  NoSuchKey: "Object not found",
  NotFound: "Not found",
  "404": "Not found",
  "AWS.SimpleQueueService.NonExistentQueue": "Queue not found",
  QueueDoesNotExist: "Queue not found",
};
const AUTH_ERROR_CODES = new Set(["InvalidAccessKeyId", "SignatureDoesNotMatch"]);

/** FastAPI's JSONResponse sends a bare `application/json`, without a charset. */
function detailResponse(status: number, detail: unknown): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Raise a FastAPI-shaped `{"detail": ...}` error response. */
export function httpError(status: 400 | 404 | 422 | 500 | 502, detail: unknown): HTTPException {
  return new HTTPException(status, { res: detailResponse(status, detail) });
}

/** Every SDK v3 service exception carries `$metadata`; the wire code lands on `name`. */
function awsErrorCode(err: unknown): string | undefined {
  if (err instanceof Error && typeof (err as { $metadata?: unknown }).$metadata === "object") return err.name;
  return undefined;
}

/**
 * Mirror of the FastAPI `ClientError` exception handler: AWS failures become
 * 404/502 with a `detail` body, anything else stays a 500.
 */
export function onError(err: Error, c: Context): Response {
  if (err instanceof HTTPException) {
    const res = err.getResponse();
    // Hono's own aborts (body-parse failures, aborted requests) are plain text.
    return res.headers.get("content-type") === "application/json"
      ? res
      : detailResponse(err.status, err.message || "Internal Server Error");
  }

  const code = awsErrorCode(err);
  if (code !== undefined) {
    const notFound = NOT_FOUND_MESSAGES[code];
    if (notFound) return detailResponse(404, notFound);
    if (AUTH_ERROR_CODES.has(code)) {
      return detailResponse(502, "AWS authentication failed. Check endpoint and credentials.");
    }
    return detailResponse(502, `AWS request failed: ${code}`);
  }

  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, err);
  return detailResponse(500, "Internal Server Error");
}

export { detailResponse };
