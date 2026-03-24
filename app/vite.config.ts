import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
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
      "@": path.resolve(__dirname, "./src"),
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor/esm/vs/language/json/json.worker")) return "jsonWorker";
          if (id.includes("monaco-editor/esm/vs/editor/editor.worker")) return "editorWorker";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "vendor";
        },
      },
    },
  },
});
