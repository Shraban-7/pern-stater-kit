import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { starterApiPlugin } from './web/plugin.ts';

export default defineConfig({
  root: 'web',
  publicDir: 'public',
  plugins: [react(), starterApiPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
});
