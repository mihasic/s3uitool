import { describe, expect, it } from "bun:test";
import { getDualPreviewKind, getParentPrefix } from "./file-utils";

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

describe("getDualPreviewKind", () => {
  it("maps the markdown extensions", () => {
    expect(getDualPreviewKind("notes.md")).toBe("markdown");
    expect(getDualPreviewKind("notes.markdown")).toBe("markdown");
  });

  it("maps both html extensions", () => {
    expect(getDualPreviewKind("index.html")).toBe("html");
    expect(getDualPreviewKind("web/index.HTM")).toBe("html");
  });

  it("maps svg", () => {
    expect(getDualPreviewKind("images/icon.svg")).toBe("svg");
  });

  it("returns null for single-format files", () => {
    expect(getDualPreviewKind("config.json")).toBeNull();
    expect(getDualPreviewKind("photo.png")).toBeNull();
    expect(getDualPreviewKind("README")).toBeNull();
  });
});
