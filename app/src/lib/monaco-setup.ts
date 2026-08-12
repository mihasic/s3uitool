import { loader } from "@monaco-editor/react";
// Import only the editor core
import * as monaco from "monaco-editor/editor";

// Workers
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/languages/features/json/json.worker?worker";

// Basic Languages (Monarch Syntax Highlighting)
import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/languages/definitions/python/register";
import "monaco-editor/languages/definitions/markdown/register";
import "monaco-editor/languages/definitions/shell/register";
import "monaco-editor/languages/definitions/yaml/register";
import "monaco-editor/languages/definitions/xml/register";
import "monaco-editor/languages/definitions/sql/register";
import "monaco-editor/languages/definitions/css/register";
import "monaco-editor/languages/definitions/scss/register";
import "monaco-editor/languages/definitions/html/register";

// Rich Languages (Workers)
// Only needed for advanced features like validation/formatting/autocomplete
import "monaco-editor/languages/features/json/register";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    // All other languages use the basic editor worker or no worker
    return new editorWorker();
  },
};

// Runs when this module loads, which the lazily imported `FileViewer` does before it
// renders an `<Editor>`. Keeping it out of the entry keeps Monaco out of that chunk.
loader.config({ monaco });
