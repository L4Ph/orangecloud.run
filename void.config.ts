import { defineConfig } from 'void/config';

export default defineConfig({
  routing: { typedRoutes: true },
  worker: { compatibility_date: '2026-10-01' },
  cloudflare: {
    worker_loaders: [{ binding: 'LOADER' }],
  },
});
