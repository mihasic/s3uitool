import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Monaco is ~2.7 MB minified and cannot be split below that, but it now sits in an
    // on-demand chunk behind the preview dialog, leaving the entry around 270 kB. The
    // limit clears that floor so the warning stops firing for a deliberate chunk.
    chunkSizeWarningLimit: 2800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor/esm/vs/languages/features/json/json.worker")) return "jsonWorker";
          if (id.includes("monaco-editor/esm/vs/editor/editor.worker")) return "editorWorker";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "vendor";
        },
      },
    },
  },
});
