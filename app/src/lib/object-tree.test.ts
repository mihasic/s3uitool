import { describe, expect, it } from "bun:test";
import type { ObjectList } from "@api/schema/s3";
import { buildItems, reachablePrefixes } from "./object-tree";

function listing(prefix: string, folders: string[], files: string[] = []): ObjectList {
  return {
    Prefix: prefix,
    CommonPrefixes: folders.map((Prefix) => ({ Prefix })),
    Objects: files.map((Key) => ({ Key, LastModified: null, ETag: "", Size: 1, StorageClass: null })),
    NextContinuationToken: null,
    IsTruncated: false,
  };
}

describe("reachablePrefixes", () => {
  it("includes folders whose ancestors are all expanded", () => {
    const expanded = new Set(["a/", "a/b/", "a/b/c/", "d/"]);
    expect(reachablePrefixes("", expanded).sort()).toEqual(["a/", "a/b/", "a/b/c/", "d/"]);
  });

  it("drops folders under a collapsed ancestor", () => {
    const expanded = new Set(["a/b/", "a/b/c/", "d/"]);
    expect(reachablePrefixes("", expanded).sort()).toEqual(["d/"]);
  });

  it("is relative to the viewed prefix", () => {
    const expanded = new Set(["root/", "root/a/", "root/a/b/", "other/"]);
    expect(reachablePrefixes("root/", expanded).sort()).toEqual(["root/a/", "root/a/b/"]);
  });
});

describe("buildItems", () => {
  const listings = new Map([
    ["", listing("", ["a/", "b/"], ["top.txt"])],
    ["a/", listing("a/", ["a/x/"], ["a/one.txt"])],
    ["b/", listing("b/", [], ["b/two.txt"])],
  ]);

  it("nests expanded folders under their parent", () => {
    const items = buildItems("", "tree", listings, new Set(["a/"]));
    expect(items.map((i) => [i.key, i.depth, i.type === "folder" ? i.isExpanded : undefined])).toEqual([
      ["a/", 0, true],
      ["a/x/", 1, false],
      ["a/one.txt", 1, undefined],
      ["b/", 0, false],
      ["top.txt", 0, undefined],
    ]);
    expect(items.find((i) => i.key === "a/one.txt")?.name).toBe("one.txt");
  });

  it("lists full keys in flat mode", () => {
    const flat = new Map([["", listing("", [], ["a/one.txt", "b/two.txt"])]]);
    expect(buildItems("", "flat", flat, new Set()).map((i) => [i.name, i.depth])).toEqual([
      ["a/one.txt", 0],
      ["b/two.txt", 0],
    ]);
  });

  it("is empty until the root listing arrives", () => {
    expect(buildItems("", "folder", new Map(), new Set())).toEqual([]);
  });
});
