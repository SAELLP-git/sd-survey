import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.join(rootDir, "client"),
  resolve: {
    alias: {
      "@shared": path.join(rootDir, "shared"),
    },
  },
  server: {
    fs: { allow: [rootDir] },
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  build: {
    outDir: path.join(rootDir, "dist"),
    emptyOutDir: true,
  },
});
