import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { lingui } from "@lingui/vite-plugin";

export default defineConfig({
  plugins: [
    lingui({ macroTransform: true }),
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
  ],
});
