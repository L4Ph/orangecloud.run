import { Link } from '@void/react';
import { routeUrl } from 'void/routes';
import { Trans, useLingui } from '@lingui/react/macro';
import { docSections, docs } from '../../docs';
import { DocsShell } from '../../lib/docs-shell';
import { I18nPage } from '../../lib/i18n-page';
import type { Props } from './index.server';

function DocsIndex({ locale }: Props) {
  const { i18n } = useLingui();

  return (
    <DocsShell locale={locale}>
      <h1 className="text-2xl font-semibold text-kumo-strong">
        <Trans>読んで学ぶ</Trans>
      </h1>
      <p className="mt-2 text-sm text-kumo-subtle">
        <Trans>手を動かす前後に読む、少し深い話。設計の判断基準をここに置いています。</Trans>
      </p>

      <div className="mt-8 space-y-8">
        {docSections.map((section) => (
          <section key={section.id}>
            <h2 className="mb-2 text-xs font-medium text-kumo-subtle">{i18n._(section.title)}</h2>
            <ul className="space-y-2">
              {docs
                .filter((doc) => doc.section === section.id)
                .map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      href={routeUrl('/docs/:slug', { params: { slug: doc.slug } })}
                      className="block rounded-lg border border-kumo-line bg-kumo-base px-4 py-3 hover:bg-kumo-tint"
                    >
                      <span className="block text-sm font-medium text-kumo-strong">
                        {i18n._(doc.title)}
                      </span>
                      <span className="mt-1 block text-sm text-kumo-subtle">
                        {i18n._(doc.summary)}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </DocsShell>
  );
}

export default function Page(props: Props) {
  return (
    <I18nPage locale={props.locale}>
      <DocsIndex {...props} />
    </I18nPage>
  );
}
