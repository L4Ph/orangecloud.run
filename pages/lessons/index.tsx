import { Link } from '@void/react';
import { routeUrl } from 'void/routes';
import { Trans, useLingui } from '@lingui/react/macro';
import { lessons } from '../../lessons';
import { SiteHeader } from '../../lib/site-header';
import { I18nPage } from '../../lib/i18n-page';
import type { Props } from './index.server';

function LessonsIndex({ locale }: Props) {
  const { i18n } = useLingui();

  return (
    <div className="min-h-dvh bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale} />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-kumo-strong">
          <Trans>動かして学ぶ</Trans>
        </h1>
        <p className="mt-2 text-sm text-kumo-subtle">
          <Trans>
            ブラウザのエディタで実行しながら進む章です。ネットワークは塞がれているので、壊しても何も起きません。
          </Trans>
        </p>

        <ol className="mt-8 space-y-2">
          {lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <Link
                href={routeUrl('/lessons/:id', { params: { id: lesson.id } })}
                className="block rounded-lg border border-kumo-line bg-kumo-base px-4 py-3 hover:bg-kumo-tint"
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-kumo-subtle">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-medium text-kumo-strong">
                    {i18n._(lesson.title)}
                  </span>
                  {!lesson.runnable && (
                    <span className="ml-auto rounded-full bg-kumo-fill px-2 py-0.5 text-xs text-kumo-subtle">
                      <Trans>資料のみ</Trans>
                    </span>
                  )}
                </span>
                <span className="mt-1 block pl-7 text-sm text-kumo-subtle">
                  {i18n._(lesson.summary)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
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
