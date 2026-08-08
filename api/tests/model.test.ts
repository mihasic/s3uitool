import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { dateTime, nullable, respondWith, stringMap } from "../src/model";

const example = z.object({
  Key: z.string().default(""),
  LastModified: dateTime,
  Size: z.number().default(0),
  StorageClass: nullable(z.string()),
});

describe("response models", () => {
  test("drops keys the schema does not declare", () => {
    const parsed = example.parse({ Key: "a.txt", Size: 3, Owner: { ID: "leaked" }, ChecksumAlgorithm: ["CRC32"] });
    expect(Object.keys(parsed).sort()).toEqual(["Key", "LastModified", "Size", "StorageClass"]);
  });

  test("applies defaults and collapses absent fields to null", () => {
    expect(example.parse({})).toEqual({ Key: "", LastModified: null, Size: 0, StorageClass: null });
    expect(example.parse({ StorageClass: null }).StorageClass).toBeNull();
  });

  test("renders dates as ISO 8601 UTC", () => {
    expect(example.parse({ LastModified: new Date("2026-08-08T12:00:00.123Z") }).LastModified).toBe(
      "2026-08-08T12:00:00.123Z",
    );
  });

  test("rejects a value the schema does not allow, naming the path", () => {
    const nested = z.object({ Objects: z.array(example) });
    expect(() => nested.parse({ Objects: [{ Size: "big" }] })).toThrow(/Objects/);
    expect(() => example.parse(null)).toThrow();
  });

  test("composes into arrays, records and extended shapes", () => {
    const extended = example.extend({ Content: nullable(z.string()) });
    expect(Object.keys(extended.parse({})).sort()).toEqual(["Content", "Key", "LastModified", "Size", "StorageClass"]);
    expect(
      z
        .array(example)
        .parse([{ Key: "a" }, { Key: "b" }])
        .map((o) => o.Key),
    ).toEqual(["a", "b"]);
    expect(z.record(z.string(), stringMap).parse({ a: { b: "1" } })).toEqual({ a: { b: "1" } });
  });

  test("respondWith sends the parsed value as JSON", async () => {
    const res = respondWith(z.array(example), [{ Key: "a.txt", Size: 2 }]);
    expect(res.headers.get("content-type")).toStartWith("application/json");
    expect(await res.json()).toEqual([{ Key: "a.txt", LastModified: null, Size: 2, StorageClass: null }]);
  });
});
