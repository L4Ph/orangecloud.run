import { Link } from '@void/react';
import { routeUrl } from 'void/routes';
import { Trans, useLingui } from '@lingui/react/macro';
import { docs } from '../../docs';
import { DocsShell } from '../../lib/docs-shell';
import { I18nPage } from '../../lib/i18n-page';
import { MarkdownArticle } from '../../lib/markdown-article';
import type { Props } from './[slug].server';

function DocPage({ locale, slug, document, headings }: Props) {
  const { i18n } = useLingui();
  const index = docs.findIndex((item) => item.slug === slug);
  const doc = docs[index];
  const previous = docs[index - 1];
  const next = docs[index + 1];

  return (
    <DocsShell locale={locale} activeSlug={slug} headings={headings}>
      <Link href="/docs" className="text-sm text-kumo-link">
        <Trans>← 読んで学ぶ</Trans>
      </Link>

      <h1 className="mt-6 text-xl font-semibold text-kumo-strong">{i18n._(doc.title)}</h1>
      <p className="mt-2 text-sm text-kumo-subtle">{i18n._(doc.summary)}</p>

      <MarkdownArticle document={document} className="mt-6" />

      <nav className="mt-12 flex items-center justify-between gap-3 border-t border-kumo-line pt-4">
        {previous ? (
          <Link
            href={routeUrl('/docs/:slug', { params: { slug: previous.slug } })}
            className="text-sm text-kumo-link"
          >
            ← {i18n._(previous.title)}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={routeUrl('/docs/:slug', { params: { slug: next.slug } })}
            className="text-sm text-kumo-link"
          >
            {i18n._(next.title)} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </DocsShell>
  );
}

export default function Page(props: Props) {
  return (
    <I18nPage locale={props.locale}>
      <DocPage {...props} />
    </I18nPage>
  );
}
