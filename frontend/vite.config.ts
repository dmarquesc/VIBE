// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // forward /api/* from the Vite dev server to your Express backend
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
        // keep the /api prefix as-is on the backend
        rewrite: (p) => p.replace(/^\/api/, "/api"),
      },
    },
  },
});







