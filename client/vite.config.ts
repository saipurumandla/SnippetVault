import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'libsodium-wrappers-sumo': require.resolve('libsodium-wrappers-sumo'),
    },
  },
  optimizeDeps: {
    include: ['libsodium-wrappers-sumo'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.tsx'],
  },
});
