declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor";
  // The editor.api might export 'editor' as a namespace, but monaco-editor exports it as 'editor'.
}

declare module "monaco-editor/esm/vs/basic-languages/*" {
  const value: any;
  export default value;
}

declare module "monaco-editor/esm/vs/language/*" {
  const value: any;
  export default value;
}
