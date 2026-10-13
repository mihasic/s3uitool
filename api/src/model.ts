import type { z } from "zod";

/**
 * Send `value` as JSON after `schema` validates it, applies defaults and drops
 * undeclared keys — so a raw SDK object can never leak into a response.
 */
export function respondWith<S extends z.ZodType>(schema: S, value: z.input<S>): Response {
  return Response.json(schema.parse(value));
}
