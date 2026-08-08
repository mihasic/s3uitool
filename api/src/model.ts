/**
 * Response models: one declaration per response shape, giving three things.
 *
 *   1. the type of the response (`Output<typeof x>`),
 *   2. the type a handler must supply (`Input<typeof x>`), which accepts the
 *      SDK's looser shapes (`string | undefined`, `Date`, …),
 *   3. a runtime projection that drops unknown keys, applies defaults and
 *      converts dates.
 *
 * Handlers end in `respondWith(model, {...})` rather than `c.json({...})`, so a
 * field renamed here but not there is a compile error, and a raw SDK object —
 * with its owner IDs, checksums and pagination noise — can never leak into a
 * response by accident.
 *
 *   const bucket = model({ Name: withDefault(str, ""), CreationDate: dateTime });
 *   return respondWith(listOf(bucket), response.Buckets ?? []);
 */

/** `In` is what a handler may pass; `Out` is what ships. */
export type Field<In, Out> = { readonly project: (value: In, path: string) => Out };

/** Contravariance in `In` makes this the top type for any field. */
type AnyField = Field<never, unknown>;
type Shape = Record<string, AnyField>;

export type Input<F> = F extends Field<infer I, unknown> ? I : never;
export type Output<F> = F extends Field<never, infer O> ? O : never;

type OptionalKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? K : never }[keyof T];
/** Fields that accept `undefined` become optional, so the SDK's `{ Key?: string }` fits. */
type Optionalise<T> = { [K in Exclude<keyof T, OptionalKeys<T>>]: T[K] } & { [K in OptionalKeys<T>]?: T[K] };

type ShapeInput<S extends Shape> = Optionalise<{ [K in keyof S]: Input<S[K]> }>;
type ShapeOutput<S extends Shape> = { [K in keyof S]: Output<S[K]> };

/** Raised when a handler hands a model something the contract does not allow. */
export class ResponseModelError extends Error {
  constructor(path: string, expected: string, received: unknown) {
    super(`response field ${path || "<root>"}: expected ${expected}, received ${JSON.stringify(received)}`);
    this.name = "ResponseModelError";
  }
}

function field<In, Out>(project: (value: In, path: string) => Out): Field<In, Out> {
  return { project };
}

export const str: Field<string, string> = field((value, path) => {
  if (typeof value !== "string") throw new ResponseModelError(path, "string", value);
  return value;
});

export const int: Field<number, number> = field((value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ResponseModelError(path, "number", value);
  return value;
});

export const bool: Field<boolean, boolean> = field((value, path) => {
  if (typeof value !== "boolean") throw new ResponseModelError(path, "boolean", value);
  return value;
});

/** ISO 8601 UTC, which is what `new Date(...)` in the client expects; absent becomes null. */
export const dateTime: Field<Date | undefined, string | null> = field((value, path) => {
  if (value === undefined) return null;
  if (!(value instanceof Date)) throw new ResponseModelError(path, "Date", value);
  return value.toISOString();
});

export const stringMap: Field<Record<string, string>, Record<string, string>> = field((value, path) => {
  if (typeof value !== "object" || value === null) throw new ResponseModelError(path, "object", value);
  return value;
});

/** `undefined` and `null` both collapse to `null`. */
export function nullable<I, O>(inner: Field<I, O>): Field<I | null | undefined, O | null> {
  return field((value, path) => (value === null || value === undefined ? null : inner.project(value, path)));
}

/** Absent becomes `fallback`, so handlers don't repeat `?? ""` at every field. */
export function withDefault<I, O>(inner: Field<I, O>, fallback: O): Field<I | undefined, O> {
  return field((value, path) => (value === undefined ? fallback : inner.project(value, path)));
}

export function listOf<I, O>(inner: Field<I, O>): Field<readonly I[], O[]> {
  return field((value, path) => {
    if (!Array.isArray(value)) throw new ResponseModelError(path, "array", value);
    return value.map((item, index) => inner.project(item, `${path}[${index}]`));
  });
}

export function recordOf<I, O>(inner: Field<I, O>): Field<Record<string, I>, Record<string, O>> {
  return field((value, path) => {
    if (typeof value !== "object" || value === null) throw new ResponseModelError(path, "object", value);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, inner.project(item as I, `${path}.${key}`)]),
    );
  });
}

/** Declare an object contract. Keys absent from `shape` are dropped from the output. */
export function model<S extends Shape>(shape: S): Field<ShapeInput<S>, ShapeOutput<S>> & { readonly shape: S } {
  const keys = Object.keys(shape);
  return {
    shape,
    project(value, path) {
      if (typeof value !== "object" || value === null) throw new ResponseModelError(path, "object", value);
      const source = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        const child = shape[key] as Field<unknown, unknown>;
        out[key] = child.project(source[key], path ? `${path}.${key}` : key);
      }
      return out as ShapeOutput<S>;
    },
  };
}

/** Serialise `value` through `schema` and send it as JSON. */
export function respondWith<I, O>(schema: Field<I, O>, value: I): Response {
  return Response.json(schema.project(value, ""));
}
