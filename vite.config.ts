import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: 'index.html',
        lab: 'lab.html',
      },
    },
  },
  worker: {
    format: 'es',
  },
  // The Python training environment (tools/train/.venv) has ~23 000 files. Without these limits the dev
  // server crawls and watches all of them, and the first page takes from 30 seconds up to two minutes.
  optimizeDeps: {
    entries: ['index.html', 'lab.html'],
  },
  server: {
    watch: {
      ignored: ['**/tools/train/**', '**/tools/.browsers/**', '**/dist/**'],
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
  },
});
