import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset paths so the build works from any subpath (GitHub Pages
  // project sites, e.g. /climbing-app/) and when served from a static host.
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    cors: true,
    // Accept requests forwarded by the preview proxy regardless of Host header.
    allowedHosts: true,
  },
});
