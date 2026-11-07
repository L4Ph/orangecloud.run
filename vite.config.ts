import { defineConfig } from 'vite-plus';
import tailwindcss from '@tailwindcss/vite';
import { voidPlugin } from 'void';
import { voidReact } from '@void/react/plugin';
import { lingui } from '@lingui/vite-plugin';

export default defineConfig({
  plugins: [
    tailwindcss(),
    lingui({ macroTransform: true }),
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
  ],
  lint: {
    ignorePatterns: [
      'dist/**',
      '.void/**',
      '.cloudflare/**',
      '.wrangler/**',
      'locales/**',
      'lessons/code/**',
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    singleQuote: true,
    printWidth: 100,
    trailingComma: 'all',
    ignorePatterns: ['dist/**', '.void/**', '.cloudflare/**', '.wrangler/**', 'locales/**'],
  },
});
