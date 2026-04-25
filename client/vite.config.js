import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/playcanvas')) return 'playcanvas';
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/@msgpack/msgpack')) return 'network';
          if (id.includes('/src/systems/howItWasMade.js')) return 'archive';
        }
      }
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/api': 'http://localhost:3001',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
