import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  envDir: false,
  server: { host: "127.0.0.1" },
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: { manualChunks: { motion: ["motion"], archive: ["jszip"] } },
    },
  },
});
