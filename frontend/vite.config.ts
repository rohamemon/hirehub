import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// In dev, /api is proxied to FastAPI so the browser sees ONE origin
// (cookies work without CORS tricks). In production, nginx does the same proxying.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000" } },
  },
});
