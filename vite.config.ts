import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { lingui } from "@lingui/vite-plugin";

export default defineConfig({
  plugins: [
    tailwindcss(),
    lingui({ macroTransform: true }),
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
  ],
  server: { port: 5173, strictPort: true },
  lint: {
    ignorePatterns: [
      "dist/**",
      ".void/**",
      ".cloudflare/**",
      ".wrangler/**",
      "locales/**",
      "lessons/code/**",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: ["dist/**", ".void/**", ".cloudflare/**", ".wrangler/**", "locales/**"],
  },
});
