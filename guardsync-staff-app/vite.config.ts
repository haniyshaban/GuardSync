import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    proxy: {
      // Proxy API requests to guardwise-platform Express server
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@guardsync/api-client": path.resolve(__dirname, "../shared/api-client/index.ts"),
      "@guardsync/types": path.resolve(__dirname, "../shared/types"),
      "@guardsync/utils": path.resolve(__dirname, "../shared/utils"),
    },
  },
}));
