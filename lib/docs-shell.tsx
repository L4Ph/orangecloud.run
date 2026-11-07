import type { ReactNode } from 'react';
import { Link } from '@void/react';
import { routeUrl } from 'void/routes';
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
    <div className="min-h-dvh bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale} />
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_170px]">
        <aside className="hidden md:block">
          <nav aria-label="Articles" className="space-y-5">
            {docSections.map((section) => (
              <div key={section.id}>
                <p className="mb-1 px-2 text-xs text-kumo-subtle">{i18n._(section.title)}</p>
                <ul className="space-y-0.5">
                  {docs
                    .filter((doc) => doc.section === section.id)
                    .map((doc) => (
                      <li key={doc.slug}>
                        <Link
                          href={routeUrl('/docs/:slug', { params: { slug: doc.slug } })}
                          className={
                            doc.slug === activeSlug
                              ? 'block rounded-md bg-kumo-tint px-2 py-1 text-kumo-strong'
                              : 'block rounded-md px-2 py-1 text-kumo-subtle hover:text-kumo-strong'
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

        <main className="min-w-0">{children}</main>

        {toc.length > 0 && (
          <aside className="hidden xl:block">
            <p className="mb-2 text-xs text-kumo-subtle">
              <Trans>このページ</Trans>
            </p>
            <ul className="space-y-1 text-xs">
              {toc.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`} className="text-kumo-subtle hover:text-kumo-strong">
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
