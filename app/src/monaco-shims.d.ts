// `@monaco-editor/loader` types its monaco instance as
// `typeof import("monaco-editor/esm/vs/editor/editor.api")`, a specifier that
// monaco-editor 0.56 no longer exposes through its `exports` map. Without this
// the import silently degrades to `any`; mapping it to the current entry point
// keeps `loader.config({ monaco })` genuinely type-checked.
declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor/editor";
}
