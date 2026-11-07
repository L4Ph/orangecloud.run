import { useMemo, type ReactNode } from 'react';
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

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
