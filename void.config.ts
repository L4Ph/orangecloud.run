import { defineConfig } from "void/config";

export default defineConfig({
  routing: { typedRoutes: true },
  head: {
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  },
  worker: { compatibility_date: "2026-10-01" },
  sandbox: { image: "./Dockerfile.sandbox" },
  cloudflare: {
    worker_loaders: [{ binding: "LOADER" }],
    // The Worker existed before its first deploy (`void secret put` created it),
    // so Void has no earlier deployment to copy these from and needs them stated.
    // routes: [] means no custom domain yet; add one here once a zone exists.
    routes: [],
    workers_dev: true,
    preview_urls: true,
  },
});
