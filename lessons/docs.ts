import type { Locale } from "../src/lib/locales";

const docs = import.meta.glob("./docs/*/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function lessonDoc(locale: Locale, id: string) {
  return docs[`./docs/${locale}/${id}.md`] ?? docs[`./docs/ja/${id}.md`] ?? "";
}
