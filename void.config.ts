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
    // Anonymous runs are limited per client IP. Counts are approximate and kept
    // per Cloudflare location. The namespace ids only need to be unique in the account.
    ratelimits: [
      { name: "RUN_LIMITER", namespace_id: "810001", simple: { limit: 30, period: 60 } },
      // Containers are the costly path, so they get a second, tighter limit.
      { name: "CONTAINER_LIMITER", namespace_id: "810002", simple: { limit: 6, period: 60 } },
    ],
    // The Worker existed before its first deploy (`void secret put` created it),
    // so Void has no earlier deployment to copy these from and needs them stated.
    // routes: [] means no custom domain yet; add one here once a zone exists.
    routes: [],
    workers_dev: true,
    preview_urls: true,
  },
});
