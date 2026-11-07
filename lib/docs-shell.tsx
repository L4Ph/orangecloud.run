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
  const { t, i18n } = useLingui();
  const toc = headings ?? [];

  const articleNav = (
    <nav aria-label={t`記事`} className="space-y-5">
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
                    aria-current={doc.slug === activeSlug ? 'page' : undefined}
                    className={
                      doc.slug === activeSlug
                        ? 'block rounded-md bg-kumo-tint px-2 py-1.5 !text-kumo-strong !no-underline'
                        : 'block rounded-md px-2 py-1.5 !text-kumo-subtle !no-underline transition-colors hover:!text-kumo-strong'
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
  );

  // Phones get the page scroll; the pinned three-pane layout starts at md.
  return (
    <div className="flex min-h-dvh flex-col bg-kumo-canvas text-sm text-kumo-default md:h-dvh md:overflow-hidden">
      <SiteHeader locale={locale} />

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-8 px-5 py-6 md:grid-cols-[190px_minmax(0,1fr)] md:px-6 md:py-8 xl:grid-cols-[190px_minmax(0,1fr)_180px]">
        <aside className="hidden min-h-0 overflow-y-auto md:block">{articleNav}</aside>

        <main id="main" className="min-h-0 min-w-0 md:overflow-y-auto md:pr-2">
          <details className="mb-6 rounded-lg bg-kumo-base ring ring-kumo-line md:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-kumo-strong">
              <Trans>記事の一覧</Trans>
            </summary>
            <div className="border-t border-kumo-line px-2 py-3">{articleNav}</div>
          </details>
          {children}
        </main>

        {toc.length > 0 && (
          <aside className="hidden min-h-0 overflow-y-auto xl:block">
            <div className="mb-3">
              <Text variant="secondary" size="xs">
                <Trans>このページ</Trans>
              </Text>
            </div>
            <TableOfContents>
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
