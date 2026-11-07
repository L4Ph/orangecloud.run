import type { ReactNode } from 'react';
import { Link } from '@cloudflare/kumo/components/link';
import { Select } from '@cloudflare/kumo/components/select';
import { Trans, useLingui } from '@lingui/react/macro';
import { localeLabel, locales, type Locale } from './locales';

const languageItems = Object.fromEntries(locales.map((item) => [item, localeLabel[item]]));

export function SiteHeader({ locale, children }: { locale: Locale; children?: ReactNode }) {
  const { t } = useLingui();
  const { pathname } = new URL(typeof window === 'undefined' ? 'http://x/' : window.location.href);

  const isCurrent = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`) ? 'text-kumo-strong' : 'text-kumo-subtle';

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-kumo-line bg-kumo-base px-5 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
        <strong className="truncate text-sm font-semibold text-kumo-strong">
          <Trans>Cloudflare Workers を動かして学ぶ</Trans>
        </strong>
        <nav className="flex items-center gap-4 text-sm" aria-label={t`学び方`}>
          <Link href="/lessons" className={`${isCurrent('/lessons')} hover:text-kumo-strong`}>
            <Trans>動かして学ぶ</Trans>
          </Link>
          <Link href="/docs" className={`${isCurrent('/docs')} hover:text-kumo-strong`}>
            <Trans>読んで学ぶ</Trans>
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {children}
        <Select
          aria-label={t`言語`}
          className="w-[110px]"
          size="sm"
          value={locale}
          onValueChange={(next) => {
            if (!next) return;
            const url = new URL(window.location.href);
            url.searchParams.set('lang', next);
            window.location.assign(url.toString());
          }}
          items={languageItems}
        />
      </div>
    </header>
  );
}
