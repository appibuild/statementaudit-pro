import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      // In dev, forward /api/* to the Express server so the API key stays server-side
      '/api': 'http://localhost:3001',
    },
  },
});
