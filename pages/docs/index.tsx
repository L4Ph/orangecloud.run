import { Link } from '@void/react';
import { routeUrl } from 'void/routes';
import { Trans, useLingui } from '@lingui/react/macro';
import { docSections, docs } from '../../docs';
import { DocsShell } from '../../lib/docs-shell';
import { I18nPage } from '../../lib/i18n-page';
import { Text } from '@cloudflare/kumo/components/text';
import type { Props } from './index.server';

function DocsIndex({ locale }: Props) {
  const { i18n } = useLingui();

  return (
    <DocsShell locale={locale}>
      <Text as="h1" variant="heading" size="lg">
        <Trans>読んで学ぶ</Trans>
      </Text>
      <div className="mt-1">
        <Text as="p" variant="secondary">
          <Trans>手を動かす前後に読む、少し深い話。設計の判断基準をここに置いています。</Trans>
        </Text>
      </div>

      <div className="mt-8 space-y-8">
        {docSections.map((section) => (
          <section key={section.id}>
            <div className="mb-2">
              <Text variant="secondary" size="xs">
                {i18n._(section.title)}
              </Text>
            </div>
            <ul className="space-y-2">
              {docs
                .filter((doc) => doc.section === section.id)
                .map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      href={routeUrl('/docs/:slug', { params: { slug: doc.slug } })}
                      className="block rounded-lg border border-kumo-line bg-kumo-base px-4 py-3 hover:bg-kumo-tint"
                    >
                      <Text variant="heading">{i18n._(doc.title)}</Text>
                      <div className="mt-1">
                        <Text as="p" variant="secondary">
                          {i18n._(doc.summary)}
                        </Text>
                      </div>
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
