import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019',
    rollupOptions: {
      output: {
        // Keep heavy libraries out of the QR page bundle
        manualChunks: { map: ['leaflet', 'react-leaflet'], charts: ['recharts'] },
      },
    },
  },
});
