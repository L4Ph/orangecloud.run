import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { lingui } from "@lingui/vite-plugin";

// Void's generated Worker entry (.void/entry.ts) exports only Durable Objects, but a Dynamic
// Worker takes custom bindings as exported WorkerEntrypoint classes. Re-export them from the entry.
const lessonBindings = (): Plugin => {
  const bindings = fileURLToPath(new URL("./lib/lesson-bindings.ts", import.meta.url));
  return {
    name: "lesson-bindings",
    enforce: "post",
    transform(code, id) {
      if (id.endsWith("/.void/entry.ts")) {
        return `${code}\nexport * from ${JSON.stringify(bindings)};\n`;
      }
    },
  };
};

export default defineConfig({
  plugins: [
    tailwindcss(),
    lingui({ macroTransform: true }),
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
    lessonBindings(),
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
