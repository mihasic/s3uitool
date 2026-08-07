import type { MiddlewareHandler } from "hono";

// Mirrors Starlette's CORSMiddleware configured with allow_origins=["*"],
// allow_credentials=True, allow_methods=["*"], allow_headers=["*"]:
// requests without an `Origin` header are left untouched, and because credentials
// are allowed the wildcard is resolved to an echo of the caller's origin.
const ALLOW_METHODS = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT";
const MAX_AGE = "600";

export const cors: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("origin");
  if (!origin) return next();

  if (c.req.method === "OPTIONS" && c.req.header("access-control-request-method")) {
    return new Response("OK", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Vary: "Origin",
        "Access-Control-Allow-Methods": ALLOW_METHODS,
        "Access-Control-Max-Age": MAX_AGE,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": c.req.header("access-control-request-headers") ?? "",
      },
    });
  }

  await next();
  c.res.headers.set("Access-Control-Allow-Origin", origin);
  c.res.headers.set("Access-Control-Allow-Credentials", "true");
  c.res.headers.append("Vary", "Origin");
};
