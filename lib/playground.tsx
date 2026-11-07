import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetch as apiFetch } from 'void/client';
import { useRouter } from '@void/react';
import { I18nPage } from './i18n-page';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from '@cloudflare/kumo/components/button';
import { Link } from '@cloudflare/kumo/components/link';
import { Select } from '@cloudflare/kumo/components/select';
import { ArrowLeftIcon, ArrowRightIcon, PlayIcon } from '@phosphor-icons/react';
import { lessons } from '../lessons';
import { Turnstile } from './turnstile';
import type { Locale } from './locales';
import { SiteHeader } from './site-header';
import { MarkdownArticle } from './markdown-article';
import type { MarkdownDocument } from '@tanstack/markdown';

type RunResult = {
  status: number;
  body: string;
  logs: string[];
  ms: number;
  error?: string;
  errorCode?: 'turnstile';
};

function CodeEditor({
  value,
  onChange,
  language,
  label,
  onRun,
}: {
  value: string;
  onChange: (next: string) => void;
  language: 'javascript' | 'shell' | 'python';
  label: string;
  onRun: () => void;
}) {
  const [ready, setReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    let disposed = false;
    let subscription: { dispose: () => void } | null = null;

    void (async () => {
      const [monaco, editorWorker] = await Promise.all([
        import('monaco-editor/editor/editor.api'),
        import('monaco-editor/editor/editor.worker?worker'),
        import('monaco-editor/languages/definitions/javascript/register'),
        import('monaco-editor/languages/definitions/shell/register'),
        import('monaco-editor/languages/definitions/python/register'),
      ]);
      if (disposed || !host.current) return;

      (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
        getWorker: () => new editorWorker.default(),
      };

      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const editor = monaco.editor.create(host.current, {
        value,
        language,
        theme: dark ? 'vs-dark' : 'vs',
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 14, bottom: 14 },
        renderLineHighlight: 'none',
        smoothScrolling: true,
        ariaLabel: label,
      });
      editorRef.current = editor;
      setReady(true);
      subscription = editor.onDidChangeModelContent(() => {
        onChangeRef.current(editor.getValue());
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunRef.current();
      });
    })();

    return () => {
      disposed = true;
      subscription?.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) editor.setValue(value);
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    void import('monaco-editor/editor/editor.api').then((monaco) => {
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, language);
    });
  }, [language]);

  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full" ref={host} />
      {/* Same text while Monaco downloads, so the pane is never an empty box. */}
      {!ready && (
        <pre className="absolute inset-0 overflow-auto px-6 py-3.5 font-mono text-[13px] leading-5 whitespace-pre-wrap text-kumo-default">
          {value}
        </pre>
      )}
    </div>
  );
}

function Playground({
  locale,
  lessonId,
  doc,
}: {
  locale: Locale;
  lessonId: string;
  doc: MarkdownDocument;
}) {
  const { t, i18n } = useLingui();
  const router = useRouter();
  const lessonIndex = Math.max(
    0,
    lessons.findIndex((item) => item.id === lessonId),
  );
  const lesson = lessons[lessonIndex];

  const [code, setCode] = useState(lesson.code);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  // The widget only exists while we wait for one, so nothing can sit over the page.
  const [awaitingToken, setAwaitingToken] = useState(false);

  useEffect(() => {
    setCode(lesson.code);
    setResult(null);
    setError(null);
  }, [lesson.id, lesson.code]);

  // Client navigation does not re-run head(), so keep the document in sync.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const execute = useCallback(
    async (value: string, turnstileToken: string | null) => {
      setPending(true);
      setError(null);
      try {
        const data: RunResult = await apiFetch('/api/run', {
          method: 'POST',
          body: {
            code: value,
            ...(lesson.runner === 'container'
              ? { lang: 'container' as const }
              : lesson.language === 'python'
                ? { lang: 'python' as const }
                : {}),
            ...(turnstileToken ? { token: turnstileToken } : {}),
          },
          timeout: 20_000,
        });
        if (data.errorCode === 'turnstile' && !turnstileToken) {
          // No pass cookie yet: ask Turnstile once, then retry with its token.
          setAwaitingToken(true);
        } else if (data.errorCode === 'turnstile') {
          setResult(null);
          setError(t`ボット対策の確認に失敗しました。もう一度お試しください。`);
        } else if (data.error) {
          setResult(null);
          setError(data.error);
        } else {
          setResult(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(false);
        // Turnstile tokens are single-use, so start over with a fresh widget.
        setToken(null);
        setWidgetKey((key) => key + 1);
      }
    },
    [lesson.language, lesson.runner, t],
  );

  const run = useCallback(() => {
    if (!lesson.runnable || pending) return;
    // The server already trusts this browser for a while, so send no token and
    // only fall back to the widget when it asks for one.
    void execute(code, token);
  }, [code, execute, lesson.runnable, pending, token]);

  // The widget answered: run with the token, then unmount it.
  useEffect(() => {
    if (!awaitingToken || !token) return;
    setAwaitingToken(false);
    void execute(code, token);
  }, [awaitingToken, token, code, execute]);

  const navigate = useCallback(
    (nextLessonId: string, nextLocale?: Locale) => {
      const lang = nextLocale ?? new URLSearchParams(window.location.search).get('lang');
      void router.visit({
        pathname: '/lessons/:id',
        params: { id: nextLessonId },
        query: lang ? { lang } : undefined,
      });
    },
    [router],
  );

  const go = useCallback(
    (delta: number) => {
      const next = lessons[Math.min(lessons.length - 1, Math.max(0, lessonIndex + delta))];
      navigate(next.id);
    },
    [lessonIndex, navigate],
  );

  const chapterItems = useMemo(
    () =>
      Object.fromEntries(
        lessons.map((item, index) => [item.id, `${index + 1}. ${i18n._(item.title)}`]),
      ),
    [i18n],
  );

  return (
    <div className="isolate flex h-dvh flex-col overflow-hidden bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale}>
        <Select
          aria-label={t`章`}
          className="min-w-0 flex-1 sm:w-[260px] sm:flex-none"
          size="sm"
          value={lesson.id}
          onValueChange={(next) => {
            if (next) navigate(next);
          }}
          items={chapterItems}
        />
      </SiteHeader>

      {awaitingToken && <Turnstile key={widgetKey} onToken={setToken} />}

      <main
        id="main"
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-lg:block max-lg:overflow-auto"
      >
        <section className="flex min-h-0 min-w-0 flex-col" aria-label={t`エディタ`}>
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3 max-sm:flex-col">
            <div className="min-w-0">
              <h1 className="text-lg leading-tight font-semibold text-kumo-strong">
                {i18n._(lesson.title)}
              </h1>
              <p className="mt-1 text-sm text-kumo-subtle">{i18n._(lesson.summary)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="primary"
                icon={<PlayIcon size={16} />}
                loading={pending}
                onClick={run}
                disabled={!lesson.runnable}
              >
                <Trans>実行</Trans>
                <kbd className="ml-2 font-sans text-xs opacity-80 [@media(hover:none)]:hidden">
                  ⌘/Ctrl+Enter
                </kbd>
              </Button>
              <Button variant="secondary" onClick={() => setCode(lesson.code)}>
                <Trans>初期化</Trans>
              </Button>
            </div>
          </div>

          {lesson.hint && (
            <p className="mx-5 mb-3 rounded-md bg-kumo-recessed px-3 py-2 text-xs text-kumo-subtle">
              {i18n._(lesson.hint)}
            </p>
          )}

          <div className="min-h-0 flex-1 border-t border-kumo-line max-lg:h-[45vh] max-lg:flex-none">
            <CodeEditor
              value={code}
              onChange={setCode}
              language={lesson.language ?? 'javascript'}
              label={t`コードエディタ`}
              onRun={run}
            />
          </div>

          <div
            role="status"
            aria-label={t`実行結果`}
            className="max-h-[42%] shrink-0 overflow-auto border-t border-kumo-line bg-kumo-base px-5 py-3 max-lg:max-h-none"
          >
            {error && (
              <pre
                role="alert"
                className="mb-2 text-xs break-words whitespace-pre-wrap text-kumo-danger"
              >
                {error}
              </pre>
            )}
            {result && (
              <>
                <p className="mb-1.5 text-xs text-kumo-subtle">
                  {lesson.runner === 'container' ? (
                    <Trans>
                      exit {result.status} · {result.ms}ms
                    </Trans>
                  ) : (
                    <Trans>
                      HTTP {result.status} · {result.ms}ms
                    </Trans>
                  )}
                </p>
                <pre className="mb-2 rounded-md bg-kumo-recessed p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-kumo-default">
                  {result.body}
                </pre>
                {result.logs.length > 0 && (
                  <>
                    <p className="mb-1.5 text-xs text-kumo-subtle">console</p>
                    <pre className="rounded-md bg-kumo-recessed p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-kumo-default">
                      {result.logs.join('\n')}
                    </pre>
                  </>
                )}
              </>
            )}
            {!error && !result && (
              <p className="text-sm text-kumo-subtle">
                {lesson.runnable ? (
                  <Trans>
                    実行するとここにレスポンスと console
                    の出力が出ます。ネットワークは塞がれていて、壊しても何も起きません。
                  </Trans>
                ) : (
                  <Trans>この単元は資料のみです。コードは参考として置いています。</Trans>
                )}
              </p>
            )}
          </div>
        </section>

        <section
          className="min-h-0 overflow-x-hidden overflow-y-auto border-l border-kumo-line bg-kumo-base px-8 py-6 max-lg:border-t max-lg:border-l-0"
          aria-label={t`資料`}
        >
          <MarkdownArticle document={doc} />
          <footer className="mt-10 max-w-[680px] border-t border-kumo-line pt-4">
            <nav className="mb-6 flex items-center justify-between gap-3" aria-label={t`章の移動`}>
              <Button
                variant="outline"
                icon={<ArrowLeftIcon size={16} />}
                onClick={() => go(-1)}
                disabled={lessonIndex === 0}
              >
                <Trans>前の章</Trans>
              </Button>
              <span className="text-xs text-kumo-subtle">
                {lessonIndex + 1} / {lessons.length}
              </span>
              <Button
                variant="outline"
                icon={<ArrowRightIcon size={16} />}
                onClick={() => go(1)}
                disabled={lessonIndex === lessons.length - 1}
              >
                <Trans>次の章</Trans>
              </Button>
            </nav>

            <p className="mb-2 text-sm font-semibold text-kumo-strong">
              <Trans>前提知識</Trans>
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-kumo-default">
              <li>
                <Link href="https://jsprimer.net/" target="_blank" rel="noreferrer">
                  JavaScript Primer
                </Link>{' '}
                — <Trans>JS がはじめてなら最初に</Trans>
              </li>
              <li>
                <Link href="https://typescriptbook.jp/" target="_blank" rel="noreferrer">
                  サバイバル TypeScript
                </Link>{' '}
                — <Trans>型が読めないと先に進みにくい</Trans>
              </li>
              <li>
                <Link
                  href="https://gihyo.jp/book/2026/978-4-297-15438-7"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Trans>Web開発者のための［入門］Cloudflare Workers</Trans>
                </Link>{' '}
                — <Trans>本気で使うなら</Trans>
              </li>
              <li>
                <Link
                  href="https://gihyo.jp/book/2026/978-4-297-15678-7"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Trans>Cloudflare Workers 実践ガイド</Trans>
                </Link>{' '}
                — <Trans>設計・運用まで</Trans>
              </li>
            </ul>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default function LessonView(props: {
  locale: Locale;
  lessonId: string;
  doc: MarkdownDocument;
}) {
  return (
    <I18nPage locale={props.locale}>
      <Playground locale={props.locale} lessonId={props.lessonId} doc={props.doc} />
    </I18nPage>
  );
}
