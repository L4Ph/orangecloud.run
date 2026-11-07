import { defineHandler, defineHead, type InferProps } from 'void';
import { marked } from 'marked';
import { resolveLocale } from '../lib/locales';
import { lessons } from '../lessons';
import { lessonDoc } from '../lessons/docs';

export const loader = defineHandler((c) => {
  const locale = resolveLocale(
    (c.get('language') as string | undefined) ?? c.req.header('accept-language'),
  );
  const requested = c.req.query('lesson');
  const lesson = lessons.find((item) => item.id === requested) ?? lessons[0];

  // The pane header already shows the chapter title.
  const docHtml = marked
    .parse(lessonDoc(locale, lesson.id), { async: false })
    .replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/, '');

  return { locale, lessonId: lesson.id, docHtml };
});

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_c, props) => ({
  htmlAttrs: { lang: props.locale },
  // Set the Kumo mode before first paint so dark mode does not flash.
  script: [
    {
      innerHTML:
        "document.documentElement.dataset.mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'",
    },
  ],
}));
