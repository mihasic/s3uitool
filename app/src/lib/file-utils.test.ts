import { describe, expect, it } from "bun:test";
import { detectLanguage, getDualPreviewKind, getParent } from "./file-utils";

describe("detectLanguage", () => {
  it("detects json objects and arrays", () => {
    expect(detectLanguage('{"a": 1}')).toBe("json");
    expect(detectLanguage("  [1, 2]\n")).toBe("json");
  });

  it("falls back when a json-looking body does not parse", () => {
    expect(detectLanguage("{not json")).toBe("plaintext");
  });

  it("detects xml", () => {
    expect(detectLanguage('<?xml version="1.0"?><a/>')).toBe("xml");
    expect(detectLanguage("<Event><id>1</id></Event>")).toBe("xml");
  });

  it("treats anything else as plain text", () => {
    expect(detectLanguage("")).toBe("plaintext");
    expect(detectLanguage("hello world")).toBe("plaintext");
  });
});

describe("getParent", () => {
  it("returns the enclosing folder", () => {
    expect(getParent("a/b/")).toBe("a/");
    expect(getParent("a/b/c.txt")).toBe("a/b/");
    expect(getParent("a/b/c/")).toBe("a/b/");
    expect(getParent("a/")).toBe("");
    expect(getParent("top.txt")).toBe("");
  });

  it("returns the root for the root", () => {
    expect(getParent("")).toBe("");
  });

  it("keeps empty segments", () => {
    expect(getParent("a//b/")).toBe("a//");
    expect(getParent("a//")).toBe("a/");
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
