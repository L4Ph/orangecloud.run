import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetch as apiFetch } from 'void/client';
import { useRouter } from '@void/react';
import { I18n, type Messages } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { Button } from '@cloudflare/kumo/components/button';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { Link } from '@cloudflare/kumo/components/link';
import { Select } from '@cloudflare/kumo/components/select';
import { ArrowLeftIcon, ArrowRightIcon, ListIcon, PlayIcon } from '@phosphor-icons/react';
import '@cloudflare/kumo/styles/standalone';
import { Trans, useLingui } from '@lingui/react/macro';
import { lessons } from '../lessons';
import { Turnstile } from '../lib/turnstile';
import { localeLabel, locales, type Locale } from '../lib/locales';
import { messages as jaMessages } from '../locales/ja/messages.po';
import { messages as enMessages } from '../locales/en/messages.po';
import { messages as zhMessages } from '../locales/zh/messages.po';
import { messages as koMessages } from '../locales/ko/messages.po';
import type { Props } from './index.server';
import './style.css';

const catalogs: Record<Locale, Messages> = {
  ja: jaMessages,
  en: enMessages,
  zh: zhMessages,
  ko: koMessages,
};

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
  onRun,
}: {
  value: string;
  onChange: (next: string) => void;
  language: 'javascript' | 'shell';
  onRun: () => void;
}) {
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
      });
      editorRef.current = editor;
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

  return <div className="editor-host" ref={host} />;
}

const languageItems = Object.fromEntries(locales.map((item) => [item, localeLabel[item]]));

function LanguageSwitcher({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
}) {
  const { t } = useLingui();

  return (
    <Select
      aria-label={t`言語`}
      className="lang-select"
      size="sm"
      value={locale}
      onValueChange={(next) => {
        if (next) onChange(next as Locale);
      }}
      items={languageItems}
    />
  );
}

function Playground({
  locale,
  lessonId,
  docHtml,
}: {
  locale: Locale;
  lessonId: string;
  docHtml: string;
}) {
  const { t, i18n } = useLingui();
  const router = useRouter();
  const [indexOpen, setIndexOpen] = useState(false);
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

  // Client navigation does not re-run head(), so keep the document language honest.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.mode = media.matches ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  const execute = useCallback(
    async (value: string, turnstileToken: string | null) => {
      setPending(true);
      setError(null);
      try {
        const data: RunResult = await apiFetch('/api/run', {
          method: 'POST',
          body: turnstileToken ? { code: value, token: turnstileToken } : { code: value },
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
    [t],
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
      const query: Record<string, string> = { lesson: nextLessonId };
      const lang = nextLocale ?? new URLSearchParams(window.location.search).get('lang');
      if (lang) query.lang = lang;
      void router.visit({ pathname: '/', query });
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

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <strong>
            <Trans>Cloudflare Workers を動かして学ぶ</Trans>
          </strong>
          <span>
            <Trans>チュートリアル兼プレイグラウンド</Trans>
          </span>
        </div>
        <div className="progress-area">
          <span className="progress">
            <Trans>
              第 {lessonIndex + 1} 章 / 全 {lessons.length} 章
            </Trans>
          </span>
          <Button
            size="sm"
            variant="secondary"
            icon={<ListIcon />}
            aria-expanded={indexOpen}
            onClick={() => setIndexOpen((open) => !open)}
          >
            <Trans>目次</Trans>
          </Button>
          <LanguageSwitcher locale={locale} onChange={(next) => navigate(lessonId, next)} />
        </div>
      </header>

      <Dialog.Root open={indexOpen} onOpenChange={setIndexOpen}>
        <Dialog size="xl" className="index-dialog">
          <Dialog.Title>
            <Trans>目次</Trans>
          </Dialog.Title>
          <ol className="index-list">
            {lessons.map((item, index) => (
              <li key={item.id}>
                <Button
                  variant="ghost"
                  className={item.id === lesson.id ? 'index-item active' : 'index-item'}
                  onClick={() => {
                    setIndexOpen(false);
                    navigate(item.id);
                  }}
                >
                  <span className="num">{String(index + 1).padStart(2, '0')}</span>
                  <span className="info">
                    <strong>{i18n._(item.title)}</strong>
                    <small>{i18n._(item.summary)}</small>
                  </span>
                </Button>
              </li>
            ))}
          </ol>
        </Dialog>
      </Dialog.Root>

      {awaitingToken && <Turnstile key={widgetKey} onToken={setToken} />}

      <main className="split">
        <section className="pane editor-pane" aria-label={t`エディタ`}>
          <div className="pane-head">
            <div>
              <h1>{i18n._(lesson.title)}</h1>
              <p>{i18n._(lesson.summary)}</p>
            </div>
            <div className="controls">
              <Button
                variant="primary"
                icon={<PlayIcon />}
                loading={pending}
                onClick={run}
                disabled={!lesson.runnable}
              >
                <Trans>実行 ⌘/Ctrl+Enter</Trans>
              </Button>
              <Button variant="secondary" onClick={() => setCode(lesson.code)}>
                <Trans>初期化</Trans>
              </Button>
            </div>
          </div>

          {lesson.hint && <p className="hint">{i18n._(lesson.hint)}</p>}

          <CodeEditor
            value={code}
            onChange={setCode}
            language={lesson.language ?? 'javascript'}
            onRun={run}
          />

          <div className="result" aria-live="polite">
            {error && <pre className="error">{error}</pre>}
            {result && (
              <>
                <p className="status">
                  <Trans>
                    HTTP {result.status} · {result.ms}ms
                  </Trans>
                </p>
                <pre>{result.body}</pre>
                {result.logs.length > 0 && (
                  <>
                    <p className="status">console</p>
                    <pre>{result.logs.join('\n')}</pre>
                  </>
                )}
              </>
            )}
            {!error && !result && (
              <p className="empty">
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

        <section className="pane doc-pane" aria-label={t`資料`}>
          <article className="doc" dangerouslySetInnerHTML={{ __html: docHtml }} />
          <footer className="doc-footer">
            <nav className="lesson-nav" aria-label={t`章の移動`}>
              <Button
                variant="outline"
                icon={<ArrowLeftIcon />}
                onClick={() => go(-1)}
                disabled={lessonIndex === 0}
              >
                <Trans>前の章</Trans>
              </Button>
              <span>
                {lessonIndex + 1} / {lessons.length}
              </span>
              <Button
                variant="outline"
                icon={<ArrowRightIcon />}
                onClick={() => go(1)}
                disabled={lessonIndex === lessons.length - 1}
              >
                <Trans>次の章</Trans>
              </Button>
            </nav>
            <p>
              <Trans>前提知識</Trans>
            </p>
            <ul>
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

export default function HomePage({ locale, lessonId, docHtml }: Props) {
  const i18n = useMemo(
    () => new I18n({ locale, messages: { [locale]: catalogs[locale] } }),
    [locale],
  );

  return (
    <I18nProvider i18n={i18n}>
      <Playground locale={locale} lessonId={lessonId} docHtml={docHtml} />
    </I18nProvider>
  );
}
