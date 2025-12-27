import { describe, expect, it } from "bun:test";
import { getParentPrefix } from "./file-utils";

describe("getParentPrefix", () => {
  it("should return empty string for empty prefix", () => {
    expect(getParentPrefix("")).toBe("");
  });

  it("should return empty string for top-level folder", () => {
    expect(getParentPrefix("folder/")).toBe("");
  });

  it("should return parent folder for nested folder", () => {
    expect(getParentPrefix("folder/subfolder/")).toBe("folder/");
  });

  it("should return parent folder for deeply nested folder", () => {
    expect(getParentPrefix("a/b/c/")).toBe("a/b/");
  });

  it("should handle prefix without trailing slash (treats last part as item to remove)", () => {
    expect(getParentPrefix("folder/file")).toBe("folder/");
  });

  it("should return empty string for single file-like prefix", () => {
    expect(getParentPrefix("file")).toBe("");
  });
});
