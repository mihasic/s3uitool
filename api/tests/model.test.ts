import { describe, expect, test } from "bun:test";
import {
  bool,
  dateTime,
  int,
  listOf,
  model,
  nullable,
  ResponseModelError,
  recordOf,
  respondWith,
  str,
  stringMap,
  withDefault,
} from "../src/model.ts";

const example = model({
  Key: withDefault(str, ""),
  LastModified: dateTime,
  Size: withDefault(int, 0),
  StorageClass: nullable(str),
});

describe("response models", () => {
  test("drops keys the contract does not declare", () => {
    const projected = example.project(
      { Key: "a.txt", Size: 3, Owner: { ID: "leaked" }, ChecksumAlgorithm: ["CRC32"] } as never,
      "",
    );
    expect(Object.keys(projected)).toEqual(["Key", "LastModified", "Size", "StorageClass"]);
  });

  test("emits keys in declaration order, not input order", () => {
    const projected = example.project({ StorageClass: "STANDARD", Size: 1, Key: "z" }, "");
    expect(JSON.stringify(projected)).toBe('{"Key":"z","LastModified":null,"Size":1,"StorageClass":"STANDARD"}');
  });

  test("applies defaults and null-collapses absent fields", () => {
    expect(example.project({}, "")).toEqual({
      Key: "",
      LastModified: null,
      Size: 0,
      StorageClass: null,
    });
    expect(example.project({ StorageClass: null }, "").StorageClass).toBeNull();
  });

  test("renders dates as ISO 8601 UTC", () => {
    expect(example.project({ LastModified: new Date("2026-08-08T12:00:00.000Z") }, "").LastModified).toBe(
      "2026-08-08T12:00:00.000Z",
    );
    expect(example.project({ LastModified: new Date("2026-08-08T12:00:00.123Z") }, "").LastModified).toBe(
      "2026-08-08T12:00:00.123Z",
    );
  });

  test("rejects a value the contract does not allow, naming the path", () => {
    const nested = model({ Objects: listOf(example) });
    expect(() => nested.project({ Objects: [{ Size: "big" as never }] }, "")).toThrow(ResponseModelError);
    expect(() => nested.project({ Objects: [{ Size: "big" as never }] }, "")).toThrow(/Objects\[0\]\.Size/);
    expect(() => example.project(null as never, "")).toThrow(/expected object/);
  });

  test("composes into lists, records and inherited shapes", () => {
    const extended = model({ ...example.shape, Content: nullable(str) });
    expect(Object.keys(extended.project({}, ""))).toEqual(["Key", "LastModified", "Size", "StorageClass", "Content"]);

    expect(
      listOf(example)
        .project([{ Key: "a" }, { Key: "b" }], "")
        .map((o) => o.Key),
    ).toEqual(["a", "b"]);
    expect(recordOf(str).project({ a: "1", b: "2" }, "")).toEqual({ a: "1", b: "2" });
  });

  test("supports the remaining primitives", () => {
    const flags = model({ On: withDefault(bool, false), Meta: nullable(stringMap) });
    expect(flags.project({}, "")).toEqual({ On: false, Meta: null });
    expect(flags.project({ On: true, Meta: { a: "1" } }, "")).toEqual({ On: true, Meta: { a: "1" } });
  });

  test("respondWith sends the projected value as JSON", async () => {
    const res = respondWith(listOf(example), [{ Key: "a.txt", Size: 2 }]);
    expect(res.headers.get("content-type")).toStartWith("application/json");
    expect(await res.json()).toEqual([{ Key: "a.txt", LastModified: null, Size: 2, StorageClass: null }]);
  });
});
