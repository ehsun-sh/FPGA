import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the build works from any sub-path (e.g. GitHub Pages)
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
