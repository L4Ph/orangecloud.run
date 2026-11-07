import type { ReactNode } from 'react';
import { useRouter } from '@void/react';
import { Link } from '@cloudflare/kumo/components/link';
import { Select } from '@cloudflare/kumo/components/select';
import { Trans, useLingui } from '@lingui/react/macro';
import { localeLabel, locales, type Locale } from './locales';

const languageItems = Object.fromEntries(locales.map((item) => [item, localeLabel[item]]));

export function SiteHeader({ locale, children }: { locale: Locale; children?: ReactNode }) {
  const { t } = useLingui();
  // Router state is the same on the server and the client, so hydration matches.
  const { path } = useRouter();

  const navLink = (href: string) => {
    const current = path === href || path.startsWith(`${href}/`);
    return {
      href,
      'aria-current': current ? ('page' as const) : undefined,
      className: `inline-flex min-h-10 items-center border-b-2 ${
        current
          ? 'border-kumo-brand font-medium text-kumo-strong'
          : 'border-transparent text-kumo-subtle hover:text-kumo-strong'
      }`,
    };
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-kumo-line bg-kumo-base px-5 py-1.5">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-kumo-base focus-visible:px-3 focus-visible:py-2 focus-visible:text-kumo-strong focus-visible:ring focus-visible:ring-kumo-line"
      >
        <Trans>本文へ移動</Trans>
      </a>
      <div className="flex min-w-0 flex-wrap items-center gap-x-5">
        <strong className="py-2 text-sm font-semibold text-kumo-strong">
          <Trans>Cloudflare Workers を動かして学ぶ</Trans>
        </strong>
        <nav className="flex items-center gap-5 text-sm" aria-label={t`学び方`}>
          <Link variant="plain" {...navLink('/lessons')}>
            <Trans>動かして学ぶ</Trans>
          </Link>
          <Link variant="plain" {...navLink('/docs')}>
            <Trans>読んで学ぶ</Trans>
          </Link>
        </nav>
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
            url.searchParams.set('lang', next);
            window.location.assign(url.toString());
          }}
          items={languageItems}
        />
      </div>
    </header>
  );
}
