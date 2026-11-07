import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "ja",
  locales: ["ja", "en", "zh", "ko"],
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["src"],
    },
  ],
});
