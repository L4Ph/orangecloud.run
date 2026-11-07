import { Link } from '@cloudflare/kumo/components/link';
import { routeUrl } from 'void/routes';
import { Text } from '@cloudflare/kumo/components/text';
import { Trans, useLingui } from '@lingui/react/macro';
import { lessonSections, lessons } from '../../lessons';
import { SiteHeader } from '../../lib/site-header';
import { I18nPage } from '../../lib/i18n-page';
import type { Props } from './index.server';

function LessonsIndex({ locale }: Props) {
  const { i18n } = useLingui();

  return (
    <div className="min-h-dvh bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale} />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <Text as="h1" variant="heading" size="lg">
          <Trans>動かして学ぶ</Trans>
        </Text>
        <div className="mt-1 max-w-2xl">
          <Text as="p" variant="secondary">
            <Trans>
              ブラウザのエディタで実行しながら進む章です。ネットワークは塞がれているので、壊しても何も起きません。
            </Trans>
          </Text>
        </div>

        <div className="mt-10 space-y-10">
          {lessonSections.map((section) => {
            const items = lessons.filter((lesson) => lesson.section === section.id);
            if (items.length === 0) return null;

            return (
              <section key={section.id}>
                <div className="mb-3 border-b border-kumo-line pb-2">
                  <Text variant="secondary" size="xs">
                    {i18n._(section.title)}
                  </Text>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {items.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={routeUrl('/lessons/:id', { params: { id: lesson.id } })}
                        variant="plain"
                        className="flex h-full w-full flex-col items-start gap-1 rounded-lg bg-kumo-base px-4 pt-3 pb-4 text-left ring ring-kumo-line hover:bg-kumo-tint"
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="font-mono text-xs text-kumo-subtle">
                            {String(lessons.indexOf(lesson) + 1).padStart(2, '0')}
                          </span>
                          <Text variant="heading">{i18n._(lesson.title)}</Text>
                        </span>
                        <Text as="span" variant="secondary">
                          {i18n._(lesson.summary)}
                        </Text>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <I18nPage locale={props.locale}>
      <LessonsIndex {...props} />
    </I18nPage>
  );
}
