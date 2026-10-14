import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin /api in dev, matching the docker/nginx setup, so no CORS config is needed locally.
    proxy: { '/api': { target: process.env.API_PROXY || 'http://localhost:8787', changeOrigin: true } },
  },
});
