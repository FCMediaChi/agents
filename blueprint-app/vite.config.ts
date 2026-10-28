import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Blueprint dev server: 3107 (QA 3103/3101, Audit 3103, Pipeline 3105).
    port: 3107,
    host: true,
    proxy: {
      '/api': {
        // Blueprint API server (see server/src/config.ts).
        target: 'http://localhost:3106',
        changeOrigin: true,
      },
    },
  },
});
