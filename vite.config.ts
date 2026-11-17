import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./src/ui', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // The Build Output API's static directory; see vite.server.config.ts.
    outDir: fileURLToPath(new URL('./.vercel/output/static', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Anchored: a bare '/api' would also catch the `/api.ts` module. The
      // Host header is kept (no `changeOrigin`), so the API sees the browser's
      // own origin: OAuth redirects and the CSRF check both depend on it.
      '^/api/': { target: 'http://localhost:8787' },
    },
  },
});
