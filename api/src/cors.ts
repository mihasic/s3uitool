import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

/** Only reached when the UI is built with `VITE_API_URL` on another origin. */
const base = cors({
  // `credentials` forbids a `*` wildcard, so echo the caller.
  origin: (origin) => origin,
  credentials: true,
  allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
  // Not CORS-safelisted; a fetch-based download needs these to read the filename.
  exposeHeaders: ["Content-Disposition", "Content-Length"],
  // Without this Chrome re-preflights every mutating request.
  maxAge: 600,
});

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  // Same-origin requests carry no Origin; hono/cors would still stamp headers.
  if (!c.req.header("origin")) return next();

  // Chrome's Private Network Access check; hono/cors doesn't cover it.
  const wantsPrivateNetwork =
    c.req.method === "OPTIONS" && c.req.header("access-control-request-private-network") === "true";

  // hono/cors answers a preflight by returning a 204; propagate it.
  const preflight = await base(c, next);
  const res = preflight ?? c.res;

  if (wantsPrivateNetwork && res.headers.has("Access-Control-Allow-Origin")) {
    res.headers.set("Access-Control-Allow-Private-Network", "true");
  }
  return preflight;
};
