import { defineHandler, defineHead, type InferProps } from 'void';
import { I18n } from '@lingui/core';
import { marked } from 'marked';
import { resolveLocale, type Locale } from '../../lib/locales';
import { catalogs } from '../../lib/catalogs';
import { lessons } from '../../lessons';
import { lessonDoc } from '../../lessons/docs';

export const loader = defineHandler((c) => {
  const lesson = lessons.find((item) => item.id === c.req.param('id'));
  if (!lesson) return c.notFound();

  const locale: Locale = resolveLocale(
    (c.get('language') as string | undefined) ?? c.req.header('accept-language'),
  );

  // The pane header already shows the chapter title.
  const docHtml = marked
    .parse(lessonDoc(locale, lesson.id), { async: false })
    .replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/, '');

  return { locale, lessonId: lesson.id, docHtml };
});

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_c, props) => {
  const lesson = lessons.find((item) => item.id === props.lessonId);
  const i18n = new I18n({
    locale: props.locale,
    messages: { [props.locale]: catalogs[props.locale] },
  });

  return {
    title: lesson ? i18n._(lesson.title) : undefined,
    meta: lesson
      ? [
          { name: 'description', content: i18n._(lesson.summary) },
          { property: 'og:title', content: i18n._(lesson.title) },
          { property: 'og:description', content: i18n._(lesson.summary) },
        ]
      : undefined,
    htmlAttrs: { lang: props.locale },
    // Set the Kumo mode before first paint so dark mode does not flash.
    script: [
      {
        innerHTML:
          "document.documentElement.dataset.mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'",
      },
    ],
  };
});
