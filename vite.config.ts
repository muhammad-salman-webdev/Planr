import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync } from "fs"; // Ensure fs is imported

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-manifest-and-offscreen", // Renamed for clarity
      closeBundle() {
        // Ensure dist directory exists
        mkdirSync("dist", { recursive: true });

        // Copy icons
        mkdirSync("dist/icons", { recursive: true });
        copyFileSync("icons/icon16.png", "dist/icons/icon16.png");
        copyFileSync("icons/icon48.png", "dist/icons/icon48.png");
        copyFileSync("icons/icon128.png", "dist/icons/icon128.png");

        // Copy manifest
        copyFileSync("manifest.json", "dist/manifest.json");

        // NEW: Explicitly copy offscreen.html from src/ to dist/
        copyFileSync("src/offscreen.html", "dist/offscreen.html");
      },
    },
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        // Keep this input for Vite to process offscreen.ts and bundle its JS
        // We'll control the HTML copy and JS name separately.
        offscreenScript: resolve(__dirname, "src/offscreen.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // If this chunk is the offscreen script (named 'offscreenScript' from input)
          if (chunkInfo.name === "offscreenScript") {
            return "offscreen.js"; // Ensure it's named offscreen.js in dist/
          }
          // For other entry points (like 'main'), output to assets/
          return `assets/[name].js`;
        },
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
