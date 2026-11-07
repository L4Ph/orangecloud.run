import { Markdown } from "@tanstack/markdown/react";
import type { MarkdownDocument } from "@tanstack/markdown";
import { highlightCode, markdownCss } from "./markdown-highlight";
import { proseTokens } from "./prose";

export function MarkdownArticle({
  document,
  className,
}: {
  document: MarkdownDocument;
  className?: string;
}) {
  return (
    <div className={`markdown-renderer ${proseTokens} ${className ?? ""}`}>
      <style>{markdownCss}</style>
      <Markdown highlighter={highlightCode}>{document}</Markdown>
    </div>
  );
}
