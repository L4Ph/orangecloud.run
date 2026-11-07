import { marked } from 'marked';

// Markdown never changes at runtime, so each isolate renders a document once.
const cache = new Map<string, string>();

export function renderDoc(key: string, source: string) {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  // The surrounding page already shows the title.
  const html = marked.parse(source, { async: false }).replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/, '');

  cache.set(key, html);
  return html;
}
