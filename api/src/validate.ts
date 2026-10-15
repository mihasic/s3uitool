import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import { z } from "zod";

export const validate = <T extends keyof ValidationTargets, S extends z.ZodType>(target: T, schema: S) =>
  validator(target, (value): z.output<S> => {
    const result = schema.safeParse(value);
    if (!result.success) throw new HTTPException(400, { message: z.prettifyError(result.error) });
    return result.data;
  });
