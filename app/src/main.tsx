import { loader } from "@monaco-editor/react";
// Import only the editor core
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

// Workers
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

// Basic Languages (Monarch Syntax Highlighting)
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
import "monaco-editor/esm/vs/basic-languages/shell/shell.contribution";
import "monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution";
import "monaco-editor/esm/vs/basic-languages/xml/xml.contribution";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
import "monaco-editor/esm/vs/basic-languages/css/css.contribution";
import "monaco-editor/esm/vs/basic-languages/scss/scss.contribution";
import "monaco-editor/esm/vs/basic-languages/html/html.contribution";

// Rich Languages (Workers)
// Only needed for advanced features like validation/formatting/autocomplete
import "monaco-editor/esm/vs/language/json/monaco.contribution";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Providers } from "./providers";
import "./index.css";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    // All other languages use the basic editor worker or no worker
    return new editorWorker();
  },
};

loader.config({ monaco });

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
