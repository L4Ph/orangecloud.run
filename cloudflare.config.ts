import { bindings, defineConfig, defineContainer, exports } from "cf/config";
import * as entrypoint from "./src/server.tsx" with { type: "cf-worker" };

// Python, Node.js and shell lessons run in this image.
const sandbox = defineContainer({
  name: "void-sandbox-v1",
  image: { dockerfile: "./Dockerfile.sandbox" },
  instanceType: "lite",
  maxInstances: 2,
});

export default defineConfig({
  // The login can reach two accounts, so the one to deploy to is fixed here.
  accountId: "0ce3c6916b7331f1aa251433a7c47c03",
  worker: {
    name: "orangecloud-run",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint,
    assets: { notFoundHandling: "none" },
    // The custom domain was attached in the dashboard; listing it keeps a deploy from detaching it.
    domains: ["orangecloud.run.l4ph.moe"],
    workersDev: true,
    previewUrls: true,
    env: {
      DB: bindings.d1({ name: "orangecloud-run-db", id: "927724c0-4cb3-4782-841e-3c107238b62d" }),
      KV: bindings.kv({ id: "d9b6b0fecc614393888726ab65b6d0b5" }),
      STORAGE: bindings.r2({ name: "orangecloud-run-storage" }),
      // Workers AI has no local simulation, so local runs use the real binding.
      AI: bindings.ai({ dev: { remote: true } }),
      LOADER: bindings.workerLoader(),
      // Anonymous runs are limited per client IP. Counts are approximate and kept per
      // Cloudflare location. The namespaces only need to be unique in the account.
      RUN_LIMITER: bindings.rateLimit({ namespace: "810001", simple: { limit: 30, period: 60 } }),
      // Containers and Durable Object storage are the costly paths, so they get a tighter limit.
      CONTAINER_LIMITER: bindings.rateLimit({
        namespace: "810002",
        simple: { limit: 6, period: 60 },
      }),
    },
    exports: {
      LessonCounterDurableObject: exports.durableObject({ storage: "sqlite" }),
      LessonUserDoDurableObject: exports.durableObject({ storage: "sqlite" }),
      SandboxV1: exports.durableObject({ storage: "sqlite", container: sandbox }),
      // Facades the sandbox no longer needs (see lib/lesson-bindings.ts). Keep each
      // tombstone until a deploy reports it safe to remove.
      LessonAiDurableObject: exports.durableObject({ state: "deleted" }),
      LessonKvDurableObject: exports.durableObject({ state: "deleted" }),
      LessonR2DurableObject: exports.durableObject({ state: "deleted" }),
    },
  },
  containers: [sandbox],
});
