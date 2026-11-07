import { cloudflare } from "@cloudflare/vite-plugin";
import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import ssrPlugin from "vite-ssr-components/plugin";

export default defineConfig({
  plugins: [tailwindcss(), lingui({ macroTransform: true }), react(), cloudflare(), ssrPlugin()],
  server: { port: 5173, strictPort: true },
  lint: {
    ignorePatterns: [
      "dist/**",
      ".cloudflare/**",
      ".wrangler/**",
      "src/locales/**",
      "src/lessons/code/**",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: ["dist/**", ".cloudflare/**", ".wrangler/**", "src/locales/**"],
  },
});
