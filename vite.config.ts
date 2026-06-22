import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/entry-[name]-[hash].js",
        chunkFileNames: "assets/chunk-[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks: {
          "react-vendor": [
            "react",
            "react-dom",
            "react-router-dom",
          ],
          "uplot": ["uplot", "uplot-react"],
          "motion": ["framer-motion"],
          "query": ["@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:25774",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
