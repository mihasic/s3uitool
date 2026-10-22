import type { ValidationTargets } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import { z } from "zod";

export const validate = <T extends keyof ValidationTargets, S extends z.ZodType>(target: T, schema: S) =>
  validator(target, (value): z.output<S> => {
    const result = schema.safeParse(value);
    if (!result.success) throw new HTTPException(400, { message: z.prettifyError(result.error) });
    return result.data;
  });

export const parseForm = createMiddleware(async (c, next) => {
  await c.req.formData().catch((e: unknown) => {
    throw new HTTPException(400, { message: `Malformed FormData request. ${e}` });
  });
  await next();
});
