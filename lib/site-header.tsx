import type { ReactNode } from "react";
import { Link } from "@cloudflare/kumo/components/link";
import { Select } from "@cloudflare/kumo/components/select";
import { GithubLogoIcon } from "@phosphor-icons/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { localeLabel, locales, type Locale } from "./locales";

const languageItems = Object.fromEntries(locales.map((item) => [item, localeLabel[item]]));

export function SiteHeader({ locale, children }: { locale: Locale; children?: ReactNode }) {
  const { t } = useLingui();
  return (
    <header className="z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-kumo-line bg-kumo-base px-5 py-1.5 lg:sticky lg:top-0 lg:h-14 lg:flex-nowrap">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-kumo-base focus-visible:px-3 focus-visible:py-2 focus-visible:text-kumo-strong focus-visible:ring focus-visible:ring-kumo-line"
      >
        <Trans>本文へ移動</Trans>
      </a>
      <div className="flex min-w-0 flex-wrap items-center gap-x-5">
        <Link
          variant="plain"
          href="/"
          className="min-h-10 !items-center text-sm font-semibold !text-kumo-strong !no-underline"
        >
          OrangeCloud.run
        </Link>
      </div>

      <div className="flex w-full items-center gap-2 py-1 sm:w-auto">
        {children}
        <Select
          aria-label={t`言語`}
          className="w-[110px] shrink-0"
          size="base"
          value={locale}
          onValueChange={(next) => {
            if (!next) return;
            // Persist for later visits, then navigate so SSR re-renders.
            document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
            const url = new URL(window.location.href);
            url.searchParams.set("lang", next);
            window.location.assign(url.toString());
          }}
          items={languageItems}
        />
        <Link
          variant="plain"
          href="https://github.com/L4Ph/orangecloud.run"
          target="_blank"
          rel="noreferrer"
          className="size-10 shrink-0 justify-center rounded-md !text-kumo-subtle !no-underline transition-colors hover:bg-kumo-tint/60 hover:!text-kumo-strong"
        >
          <GithubLogoIcon aria-hidden size={20} />
          <span className="sr-only">
            <Trans>GitHub のリポジトリ</Trans> <Trans>（新しいタブで開く）</Trans>
          </span>
        </Link>
      </div>
    </header>
  );
}
