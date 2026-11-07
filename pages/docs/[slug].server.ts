import { defineHandler, defineHead, type InferProps } from 'void';
import { I18n } from '@lingui/core';
import { requestLocale } from '../../lib/request-locale';
import { catalogs } from '../../lib/catalogs';
import { docs } from '../../docs';
import { docBody } from '../../docs/bodies';
import { parseDoc, tocOf } from '../../lib/markdown-source';

export const loader = defineHandler((c) => {
  const doc = docs.find((item) => item.slug === c.req.param('slug'));
  if (!doc) return c.notFound();

  const locale = requestLocale(c);

  const document = parseDoc(docBody(locale, doc.slug));
  return { locale, slug: doc.slug, document, headings: tocOf(document) };
});

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_c, props) => {
  const doc = docs.find((item) => item.slug === props.slug);
  const i18n = new I18n({
    locale: props.locale,
    messages: { [props.locale]: catalogs[props.locale] },
  });

  return {
    title: doc ? i18n._(doc.title) : undefined,
    meta: doc
      ? [
          { name: 'description', content: i18n._(doc.summary) },
          { property: 'og:title', content: i18n._(doc.title) },
          { property: 'og:description', content: i18n._(doc.summary) },
        ]
      : undefined,
    htmlAttrs: { lang: props.locale },
    script: [
      {
        innerHTML:
          "document.documentElement.dataset.mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'",
      },
    ],
  };
});
