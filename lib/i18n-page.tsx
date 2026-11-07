import { useEffect, useMemo, type ReactNode } from "react";
import { I18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { LinkProvider } from "@cloudflare/kumo";
import { AppLink } from "./app-link";
import { catalogs } from "./catalogs";
import type { Locale } from "./locales";

export function I18nPage({ locale, children }: { locale: Locale; children: ReactNode }) {
  const i18n = useMemo(
    () => new I18n({ locale, messages: { [locale]: catalogs[locale] } }),
    [locale],
  );

  // Remember the rendered language, including when it came from ?lang=.
  useEffect(() => {
    document.cookie = `lang=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  // Kumo switches themes with data-mode; keep it in step with the OS.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.mode = media.matches ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <I18nProvider i18n={i18n}>
      <LinkProvider component={AppLink}>{children}</LinkProvider>
    </I18nProvider>
  );
}
