export const locales = ['ja', 'en', 'zh', 'ko'] as const;
export type Locale = (typeof locales)[number];

export const sourceLocale: Locale = 'ja';

export const localeLabel: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  zh: '简体中文',
  ko: '한국어',
};

export const hreflang: Record<Locale, string> = {
  ja: 'ja',
  en: 'en',
  zh: 'zh-Hans',
  ko: 'ko',
};

export function resolveLocale(value: string | null | undefined): Locale {
  const base = (value ?? '').toLowerCase().split('-')[0];
  return (locales as readonly string[]).includes(base) ? (base as Locale) : sourceLocale;
}
