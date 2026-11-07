import { Trans, useLingui } from "@lingui/react/macro";
import {
  TableOfContents,
  useTableOfContentsActiveId,
} from "@cloudflare/kumo/components/table-of-contents";
import { Text } from "@cloudflare/kumo/components/text";
import { ChapterFooter, ChapterHeader, ContentShell } from "../../lib/content-shell";
import { I18nPage } from "../../lib/i18n-page";
import { MarkdownArticle } from "../../lib/markdown-article";
import type { Props } from "./[slug].server";

function DocPage({ locale, slug, document, headings }: Props) {
  const { t } = useLingui();
  const key = `doc-${slug}`;
  // The sticky header covers the top of the window; count the line below it.
  const { activeId, selectSection } = useTableOfContentsActiveId({
    ids: headings.map((heading) => heading.id),
    offset: 96,
  });

  return (
    <ContentShell locale={locale} activeKey={key}>
      {/* The article sits in the middle of the space the sidebar leaves; the
          table of contents hangs on the right edge. */}
      <div
        className={headings.length > 0 ? "xl:grid xl:grid-cols-[minmax(0,1fr)_200px] xl:gap-8" : ""}
      >
        <div className="mx-auto w-full max-w-[680px] min-w-0">
          <ChapterHeader activeKey={key} />
          <MarkdownArticle document={document} className="mt-8" />
          <ChapterFooter activeKey={key} className="mt-12" />
        </div>

        {headings.length > 0 && (
          <div className="sticky top-22 hidden max-h-[calc(100dvh-7.5rem)] self-start overflow-y-auto overscroll-contain xl:block">
            <div className="mb-3">
              <Text variant="secondary" size="xs">
                <Trans>このページ</Trans>
              </Text>
            </div>
            <TableOfContents aria-label={t`このページ`}>
              <TableOfContents.List>
                {headings.map((heading) => (
                  <TableOfContents.Item
                    key={heading.id}
                    render={<a href={`#${heading.id}`} />}
                    active={heading.id === activeId}
                    aria-current={heading.id === activeId ? "location" : undefined}
                    onClick={() => selectSection(heading.id)}
                    // Kumo truncates these; a heading you cannot read is no use, so wrap.
                    className="!py-1 !overflow-visible !text-clip !whitespace-normal"
                  >
                    {heading.text}
                  </TableOfContents.Item>
                ))}
              </TableOfContents.List>
            </TableOfContents>
          </div>
        )}
      </div>
    </ContentShell>
  );
}

export default function Page(props: Props) {
  return (
    <I18nPage locale={props.locale}>
      <DocPage {...props} />
    </I18nPage>
  );
}
