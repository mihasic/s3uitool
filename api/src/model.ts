import { z } from "zod";

/** `undefined` and `null` both become `null`. */
export const nullable = <T extends z.ZodType>(schema: T) => schema.nullish().transform((v) => v ?? null);

/** SDK `Date` as ISO 8601 UTC. */
export const dateTime = nullable(z.date()).transform((d) => (d ? d.toISOString() : null));

export const stringMap = z.record(z.string(), z.string());

/**
 * Send `value` as JSON after `schema` validates it, applies defaults and drops
 * undeclared keys — so a raw SDK object can never leak into a response.
 */
export function respondWith<S extends z.ZodType>(schema: S, value: z.input<S>): Response {
  return Response.json(schema.parse(value));
}
