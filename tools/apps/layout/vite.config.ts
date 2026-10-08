import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "marked",
      "mammoth/mammoth.browser.js",
      "read-excel-file/browser",
      "fflate",
      "fix-webm-duration",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    // Workspace edits can miss native macOS file events; polling keeps the preview current.
    watch: { usePolling: true, interval: 300 },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@phosphor-icons/")) return "icons";
          if (
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react/")
          )
            return "react";
        },
      },
    },
  },
});
