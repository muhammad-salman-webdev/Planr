import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        // Ensure dist directory exists
        mkdirSync('dist', { recursive: true });
        
        // Copy manifest
        copyFileSync('manifest.json', 'dist/manifest.json');
        
        // Copy icons
        mkdirSync('dist/icons', { recursive: true });
        copyFileSync('icons/icon16.png', 'dist/icons/icon16.png');
        copyFileSync('icons/icon48.png', 'dist/icons/icon48.png');
        copyFileSync('icons/icon128.png', 'dist/icons/icon128.png');
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 3000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});