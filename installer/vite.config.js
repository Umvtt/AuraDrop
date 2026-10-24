import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The setup UI is a separate Vite app that shares the root node_modules.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1430, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome110",
    minify: !process.env.TAURI_ENV_DEBUG,
  },
});
