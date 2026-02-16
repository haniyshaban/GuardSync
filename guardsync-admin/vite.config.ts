import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // Avoid Vite pre-bundling a stale optimized react-leaflet build that can
  // incorrectly render Context as a Consumer (causing: "render2 is not a function").
  optimizeDeps: {
    // Ensure Leaflet is pre-bundled so ESM named-exports (like DomUtil) are available.
    // Keep react-leaflet/core pre-bundled as well to avoid runtime mismatch.
    exclude: ["react-leaflet"],
    include: ["react", "react-dom", "react/jsx-runtime", "leaflet", "@react-leaflet/core"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@guardsync/types": path.resolve(__dirname, "../shared/types"),
      "@guardsync/utils": path.resolve(__dirname, "../shared/utils"),
    },
  },
}));
