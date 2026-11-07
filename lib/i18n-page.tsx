import { useEffect, useMemo, type ReactNode } from 'react';
import { I18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { catalogs } from './catalogs';
import type { Locale } from './locales';
import './app.css';

export function I18nPage({ locale, children }: { locale: Locale; children: ReactNode }) {
  const i18n = useMemo(
    () => new I18n({ locale, messages: { [locale]: catalogs[locale] } }),
    [locale],
  );

  // Remember the rendered language, including when it came from ?lang=.
  useEffect(() => {
    document.cookie = `lang=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
