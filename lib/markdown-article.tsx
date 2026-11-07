import { Markdown } from '@tanstack/markdown/react';
import { highlightCode, markdownCss } from './markdown-highlight';
import { proseTokens } from './prose';

export function MarkdownArticle({ source, className }: { source: string; className?: string }) {
  return (
    <div className={`markdown-renderer ${proseTokens} ${className ?? ''}`}>
      <style>{markdownCss}</style>
      <Markdown highlighter={highlightCode}>{source}</Markdown>
    </div>
  );
}
