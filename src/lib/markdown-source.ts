import { parseMarkdown } from "@tanstack/markdown/parser";
import type { InlineNode, MarkdownDocument } from "@tanstack/markdown";

export type TocHeading = { id: string; text: string };

const textOf = (nodes: InlineNode[]): string =>
  nodes
    .map((node) => {
      if ("value" in node && typeof node.value === "string") return node.value;
      if ("children" in node && Array.isArray(node.children)) {
        return textOf(node.children as InlineNode[]);
      }
      return "";
    })
    .join("");

// The page heading already shows the title, so drop the leading H1.
export function parseDoc(source: string): MarkdownDocument {
  return parseMarkdown(source.replace(/^# .+\n+/, ""), { headingIds: true });
}

export function tocOf(document: MarkdownDocument): TocHeading[] {
  return document.children.flatMap((node) =>
    node.type === "heading" && node.depth === 2 && node.id
      ? [{ id: node.id, text: textOf(node.children) }]
      : [],
  );
}
