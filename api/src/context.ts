import type { S3Client } from "@aws-sdk/client-s3";
import type { SQSClient } from "@aws-sdk/client-sqs";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Profile } from "./profiles";

export type AppEnv = {
  Variables: {
    profile: Profile;
    s3: S3Client;
    sqs: SQSClient;
  };
};

type Service = "s3" | "sqs";

export function requireService<K extends Service>(
  service: K,
  client: (profile: Profile) => AppEnv["Variables"][K],
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const profile = c.get("profile");
    if (!profile[service]) {
      throw new HTTPException(404, {
        message: `${service.toUpperCase()} is not enabled for profile "${profile.id}"`,
      });
    }
    c.set(service, client(profile));
    await next();
  };
}
