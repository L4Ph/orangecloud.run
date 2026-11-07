import type { Locale } from "../src/lib/locales";

const bodies = import.meta.glob("./content/*/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function docBody(locale: Locale, slug: string) {
  return bodies[`./content/${locale}/${slug}.md`] ?? bodies[`./content/ja/${slug}.md`] ?? "";
}
