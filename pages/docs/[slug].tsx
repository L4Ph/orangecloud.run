import { Link } from '@void/react';
import { routeUrl } from 'void/routes';
import { Trans, useLingui } from '@lingui/react/macro';
import { docs } from '../../docs';
import { SiteHeader } from '../../lib/site-header';
import { I18nPage } from '../../lib/i18n-page';
import { proseTokens } from '../../lib/prose';
import type { Props } from './[slug].server';

function DocArticle({ locale, slug, docHtml }: Props) {
  const { i18n } = useLingui();
  const index = docs.findIndex((item) => item.slug === slug);
  const doc = docs[index];
  const previous = docs[index - 1];
  const next = docs[index + 1];

  return (
    <div className="min-h-dvh bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale} />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link href="/docs" className="text-sm text-kumo-link">
          <Trans>← 読んで学ぶ</Trans>
        </Link>

        <h1 className="mt-6 text-xl font-semibold text-kumo-strong">{i18n._(doc.title)}</h1>
        <p className="mt-2 text-sm text-kumo-subtle">{i18n._(doc.summary)}</p>

        <article className={`${proseTokens} mt-6`} dangerouslySetInnerHTML={{ __html: docHtml }} />

        <nav className="mt-10 flex items-center justify-between gap-3 border-t border-kumo-line pt-4">
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
      </main>
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <I18nPage locale={props.locale}>
      <DocArticle {...props} />
    </I18nPage>
  );
}
