import { defineHandler, defineHead, type InferProps } from 'void';
import { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { resolveLocale } from '../../lib/locales';
import { catalogs } from '../../lib/catalogs';

export const loader = defineHandler((c) => ({
  locale: resolveLocale(
    (c.get('language') as string | undefined) ?? c.req.header('accept-language'),
  ),
}));

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_c, props) => {
  const i18n = new I18n({
    locale: props.locale,
    messages: { [props.locale]: catalogs[props.locale] },
  });

  return {
    title: i18n._(msg`動かして学ぶ`),
    htmlAttrs: { lang: props.locale },
    script: [
      {
        innerHTML:
          "document.documentElement.dataset.mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'",
      },
    ],
  };
});
