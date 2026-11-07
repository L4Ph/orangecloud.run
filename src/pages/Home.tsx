import { Link } from "@cloudflare/kumo/components/link";
import { Text } from "@cloudflare/kumo/components/text";
import { Trans, useLingui } from "@lingui/react/macro";
import { catalog, catalogSections } from "../lib/catalog";
import { Kind } from "../components/content-shell";
import { SiteHeader } from "../components/site-header";
import { I18nPage } from "../components/i18n-page";
import type { Locale } from "../lib/locales";

export type Props = { locale: Locale };

function LessonsIndex({ locale }: Props) {
  const { i18n } = useLingui();

  return (
    <div className="min-h-dvh bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6 sm:py-10">
        <Text as="h1" variant="heading" size="lg">
          <Trans>学ぶ</Trans>
        </Text>
        <div className="mt-1 max-w-2xl space-y-1">
          <Text as="p" variant="secondary">
            <Trans>
              「動かす」は、ブラウザのエディタに書いたコードをサーバーで実行しながら進む章です。「読む」は、仕組み・選び方・手順を解説した記事です。
            </Trans>
          </Text>
          <Text as="p" variant="secondary">
            <Trans>
              「動かす」の章ではネットワークが塞がれていますが、D1・KV・R2・Durable Object
              の状態は訪問者全員で共有されます。
            </Trans>
          </Text>
        </div>

        <div className="mt-10 space-y-10">
          {catalogSections.map((section) => {
            const items = catalog.filter((entry) => entry.section === section.id);

            return (
              <section key={section.id} aria-labelledby={`section-${section.id}`}>
                <div className="mb-3 border-b border-kumo-line pb-2">
                  <Text as="h2" variant="secondary" size="xs" id={`section-${section.id}`}>
                    {i18n._(section.title)}
                  </Text>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        variant="plain"
                        className="flex h-full w-full !flex-col !items-start !gap-1 rounded-lg bg-kumo-base px-4 pt-3 pb-4 text-left ring ring-kumo-line transition-colors hover:bg-kumo-tint"
                      >
                        <span className="text-xs text-kumo-subtle">
                          <Kind run={item.run} />
                        </span>
                        <Text variant="heading">{i18n._(item.title)}</Text>
                        <Text as="span" variant="secondary">
                          {i18n._(item.summary)}
                        </Text>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-10">
          <Link href="/books" className="text-sm text-kumo-link">
            <Trans>書籍の紹介 →</Trans>
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function Home(props: Props) {
  return (
    <I18nPage locale={props.locale}>
      <LessonsIndex {...props} />
    </I18nPage>
  );
}
