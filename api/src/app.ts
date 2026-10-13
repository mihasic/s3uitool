import { statSync } from "node:fs";
import { join } from "node:path";
import type { Context, Next } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./context";
import { corsMiddleware } from "./cors";
import { onError } from "./errors";
import { callerIdentity } from "./identity";
import { findProfile, getRegistry, toPublicProfile } from "./profiles";
import { s3Routes } from "./s3";
import { sqsRoutes } from "./sqs";
import { resolveStaticFile } from "./static";

// Checked per-request, so running without a bundled frontend (dev) still works.
const STATIC_DIR = process.env.STATIC_DIR ?? "/app/static";

export const app = new Hono<AppEnv>();

app.use("*", corsMiddleware);

app.onError(onError);

/** `id` is undefined on the unprefixed legacy routes, which stay bound to the default. */
async function withProfile(c: Context<AppEnv>, next: Next, id?: string): Promise<void> {
  const wanted = id ? decodeURIComponent(id) : (await getRegistry()).defaultId;
  const profile = await findProfile(wanted);
  if (!profile) throw new HTTPException(404, { message: `Unknown profile "${wanted}"` });
  c.set("profile", profile);
  await next();
}

for (const service of ["s3", "sqs"]) {
  app.use(`/api/${service}/*`, (c, next) => withProfile(c, next));
  app.use(`/api/:profile/${service}/*`, (c, next) => withProfile(c, next, c.req.param("profile")));
}

app.route("/api/:profile/s3", s3Routes);
app.route("/api/:profile/sqs", sqsRoutes);

// Kept so existing bookmarks, scripts and older frontends keep working.
app.route("/api/s3", s3Routes);
app.route("/api/sqs", sqsRoutes);

app.get("/api/config", async (c) => {
  const { profiles, defaultId } = await getRegistry(true);
  return c.json({ defaultProfile: defaultId, profiles: profiles.map(toPublicProfile) });
});

app.use("/api/:profile/identity", (c, next) => withProfile(c, next, c.req.param("profile")));
app.get("/api/:profile/identity", async (c) => c.json(await callerIdentity(c.get("profile"))));

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
