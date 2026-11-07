import { Link } from "@cloudflare/kumo/components/link";
import { Text } from "@cloudflare/kumo/components/text";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { Trans } from "@lingui/react/macro";
import { SiteHeader } from "../components/site-header";
import { I18nPage } from "../components/i18n-page";
import type { Locale } from "../lib/locales";

export type Props = { locale: Locale };

function BookCard({
  href,
  title,
  note,
}: {
  href: string;
  title: React.ReactNode;
  note: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        target="_blank"
        rel="noreferrer"
        variant="plain"
        className="flex h-full w-full !flex-col !items-start !gap-1 rounded-lg bg-kumo-base px-4 pt-3 pb-4 text-left ring ring-kumo-line transition-colors hover:bg-kumo-tint"
      >
        <span className="flex w-full items-start justify-between gap-3">
          <Text variant="heading">{title}</Text>
          <ArrowUpRightIcon aria-hidden size={16} className="mt-1 shrink-0 text-kumo-subtle" />
        </span>
        <Text as="span" variant="secondary">
          {note}
        </Text>
        <span className="sr-only">
          <Trans>（新しいタブで開く）</Trans>
        </span>
      </Link>
    </li>
  );
}

function BooksPage({ locale }: Props) {
  return (
    <div className="min-h-dvh bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6 sm:py-10">
        <Link href="/" className="inline-flex min-h-10 items-center text-sm text-kumo-link">
          <Trans>← 学ぶ</Trans>
        </Link>
        <div className="mt-6">
          <Text as="h1" variant="heading" size="lg">
            <Trans>書籍の紹介</Trans>
          </Text>
        </div>
        <div className="mt-1 max-w-2xl space-y-1">
          <Text as="p" variant="secondary">
            <Trans>このサイトで足りなくなったら、本で通して学べます。</Trans>
          </Text>
          {locale !== "ja" && (
            <Text as="p" variant="secondary">
              <Trans comment="Shown only when the page language is not Japanese.">
                どちらも日本語の本です。
              </Trans>
            </Text>
          )}
        </div>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          <BookCard
            href="https://gihyo.jp/book/2026/978-4-297-15438-7"
            title={
              <Trans comment="Book title. Keep the Japanese original in every language.">
                Web開発者のための［入門］Cloudflare Workers
              </Trans>
            }
            note={<Trans>手軽な入門書。ハンズオンで基本から一歩進んだ使い方まで</Trans>}
          />
          <BookCard
            href="https://gihyo.jp/book/2026/978-4-297-15678-7"
            title={
              <Trans comment="Book title. Keep the Japanese original in every language.">
                Cloudflare Workers 実践ガイド
              </Trans>
            }
            note={<Trans>設計・実装・運用まで</Trans>}
          />
        </ul>
      </main>
    </div>
  );
}

export default function Books(props: Props) {
  return (
    <I18nPage locale={props.locale}>
      <BooksPage {...props} />
    </I18nPage>
  );
}
