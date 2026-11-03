import { defineConfig, type Plugin } from 'vitest/config';

/** npm run dev:api: /api goes to node server.js (see tools/dev-api.ts) */
const API_PROXY = process.env.API_PROXY;

/** /admin is admin.html and /vorstellung is vorstellung.html, like on the server */
const adminRoute: Plugin = {
  name: 'admin-route',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/admin' || req.url === '/admin/') req.url = '/admin.html';
      if (req.url === '/vorstellung' || req.url === '/vorstellung/') req.url = '/vorstellung.html';
      next();
    });
  },
};

export default defineConfig({
  plugins: [adminRoute],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: 'index.html',
        lab: 'lab.html',
        admin: 'admin.html',
        vorstellung: 'vorstellung.html',
      },
    },
  },
  worker: {
    format: 'es',
  },
  // The Python training environment (tools/train/.venv) has ~23 000 files. Without these limits the dev
  // server crawls and watches all of them, and the first page takes from 30 seconds up to two minutes.
  optimizeDeps: {
    entries: ['index.html', 'lab.html', 'admin.html', 'vorstellung.html'],
  },
  server: {
    watch: {
      ignored: ['**/tools/train/**', '**/tools/.browsers/**', '**/dist/**'],
    },
    proxy: API_PROXY ? { '/api': { target: API_PROXY, changeOrigin: false } } : undefined,
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
  },
});
