import type { ReactNode } from 'react';
import { routeUrl } from 'void/routes';
import { Link } from '@cloudflare/kumo/components/link';
import { TableOfContents } from '@cloudflare/kumo/components/table-of-contents';
import { Text } from '@cloudflare/kumo/components/text';
import { Trans, useLingui } from '@lingui/react/macro';
import { docSections, docs } from '../docs';
import { SiteHeader } from './site-header';
import type { Locale } from './locales';
import type { TocHeading } from './markdown-source';

export function DocsShell({
  locale,
  activeSlug,
  headings,
  children,
}: {
  locale: Locale;
  activeSlug?: string;
  headings?: TocHeading[];
  children: ReactNode;
}) {
  const { i18n } = useLingui();
  const toc = headings ?? [];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale} />

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-8 px-6 py-8 md:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_180px]">
        <aside className="hidden min-h-0 overflow-y-auto md:block">
          <nav aria-label="Articles" className="space-y-5">
            {docSections.map((section) => (
              <div key={section.id}>
                <div className="mb-1 px-2">
                  <Text variant="secondary" size="xs">
                    {i18n._(section.title)}
                  </Text>
                </div>
                <ul className="space-y-0.5">
                  {docs
                    .filter((doc) => doc.section === section.id)
                    .map((doc) => (
                      <li key={doc.slug}>
                        <Link
                          href={routeUrl('/docs/:slug', { params: { slug: doc.slug } })}
                          variant={doc.slug === activeSlug ? 'current' : 'plain'}
                          className={
                            doc.slug === activeSlug
                              ? 'block rounded-md bg-kumo-tint px-2 py-1 !text-kumo-strong !no-underline'
                              : 'block rounded-md px-2 py-1 !text-kumo-subtle !no-underline hover:!text-kumo-strong'
                          }
                        >
                          {i18n._(doc.title)}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-h-0 min-w-0 overflow-y-auto pr-2">{children}</main>

        {toc.length > 0 && (
          <aside className="hidden min-h-0 overflow-y-auto xl:block">
            <TableOfContents>
              <TableOfContents.Title>
                <Trans>このページ</Trans>
              </TableOfContents.Title>
              <TableOfContents.List>
                {toc.map((heading) => (
                  <TableOfContents.Item key={heading.id} render={<a href={`#${heading.id}`} />}>
                    {heading.text}
                  </TableOfContents.Item>
                ))}
              </TableOfContents.List>
            </TableOfContents>
          </aside>
        )}
      </div>
    </div>
  );
}
