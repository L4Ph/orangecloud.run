import { defineConfig } from 'void/config';

export default defineConfig({
  routing: { typedRoutes: true },
  head: {
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  },
  worker: { compatibility_date: '2026-10-01' },
  sandbox: { image: './Dockerfile.sandbox' },
  cloudflare: {
    worker_loaders: [{ binding: 'LOADER' }],
  },
});
