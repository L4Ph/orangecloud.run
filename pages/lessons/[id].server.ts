import { defineHandler, defineHead, type InferProps } from 'void';
import { I18n } from '@lingui/core';
import { requestLocale } from '../../lib/request-locale';
import { catalogs } from '../../lib/catalogs';
import { lessons } from '../../lessons';
import { lessonDoc } from '../../lessons/docs';

export const loader = defineHandler((c) => {
  const lesson = lessons.find((item) => item.id === c.req.param('id'));
  if (!lesson) return c.notFound();

  const locale = requestLocale(c);

  // The pane header already shows the chapter title.
  const source = lessonDoc(locale, lesson.id).replace(/^# .+\n+/, '');

  return { locale, lessonId: lesson.id, source };
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
