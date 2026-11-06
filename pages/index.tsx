import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetch as apiFetch } from 'void/client';
import { I18n, type Messages } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { marked } from 'marked';
import { lessonDoc, lessons } from '../lessons';
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

type RunResult = { status: number; body: string; logs: string[]; ms: number; error?: string };

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

    (async () => {
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
    import('monaco-editor/editor/editor.api').then((monaco) => {
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, language);
    });
  }, [language]);

  return <div className="editor-host" ref={host} />;
}

function LanguageSwitcher({ locale }: { locale: Locale }) {
  function change(next: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.location.assign(url.toString());
  }

  return (
    <label className="language-switcher">
      <select value={locale} onChange={(event) => change(event.target.value)}>
        {locales.map((item) => (
          <option key={item} value={item}>
            {localeLabel[item]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Playground({ locale }: { locale: Locale }) {
  const { t, i18n } = useLingui();
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const [indexOpen, setIndexOpen] = useState(false);
  const lessonIndex = Math.max(0, lessons.findIndex((item) => item.id === lessonId));
  const lesson = lessons[lessonIndex];

  const [code, setCode] = useState(lesson.code);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCode(lesson.code);
    setResult(null);
    setError(null);
  }, [lesson.id, lesson.code]);

  const run = useCallback(async () => {
    if (!lesson.runnable || pending) return;
    setPending(true);
    setError(null);
    try {
      const data: RunResult = await apiFetch('/api/run', {
        method: 'POST',
        body: { code },
        timeout: 20_000,
      });
      if (data.error) {
        setResult(null);
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }, [code, lesson.runnable, pending]);

  const go = useCallback(
    (delta: number) => {
      const next = lessons[Math.min(lessons.length - 1, Math.max(0, lessonIndex + delta))];
      setLessonId(next.id);
    },
    [lessonIndex],
  );

  const docHtml = marked.parse(lessonDoc(locale, lesson.id), { async: false });

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
          <button
            type="button"
            className="index-toggle"
            aria-expanded={indexOpen}
            onClick={() => setIndexOpen((open) => !open)}
          >
            <Trans>目次</Trans>
          </button>
          <LanguageSwitcher locale={locale} />
        </div>
      </header>

      {indexOpen && (
        <div className="index-overlay" onClick={() => setIndexOpen(false)}>
          <nav
            className="index-panel"
            aria-label={t`目次`}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="index-title">
              <Trans>目次</Trans>
            </p>
            <ol>
              {lessons.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === lesson.id ? 'index-item active' : 'index-item'}
                    onClick={() => {
                      setLessonId(item.id);
                      setIndexOpen(false);
                    }}
                  >
                    <span className="num">{String(index + 1).padStart(2, '0')}</span>
                    <span className="info">
                      <strong>{i18n._(item.title)}</strong>
                      <small>{i18n._(item.summary)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}

      <main className="split">
        <section className="pane editor-pane" aria-label={t`エディタ`}>
          <div className="pane-head">
            <div>
              <h1>{i18n._(lesson.title)}</h1>
              <p>{i18n._(lesson.summary)}</p>
            </div>
            <div className="controls">
              <button type="button" onClick={run} disabled={!lesson.runnable || pending}>
                {pending ? <Trans>実行中…</Trans> : <Trans>実行 ⌘/Ctrl+Enter</Trans>}
              </button>
              <button type="button" className="ghost" onClick={() => setCode(lesson.code)}>
                <Trans>初期化</Trans>
              </button>
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
                    実行するとここにレスポンスと console の出力が出ます。ネットワークは塞がれていて、壊しても何も起きません。
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
              <button type="button" onClick={() => go(-1)} disabled={lessonIndex === 0}>
                <Trans>← 前の章</Trans>
              </button>
              <span>
                {lessonIndex + 1} / {lessons.length}
              </span>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={lessonIndex === lessons.length - 1}
              >
                <Trans>次の章 →</Trans>
              </button>
            </nav>
            <p>
              <Trans>前提知識</Trans>
            </p>
            <ul>
              <li>
                <a href="https://jsprimer.net/" target="_blank" rel="noreferrer">
                  JavaScript Primer
                </a>{' '}
                — <Trans>JS がはじめてなら最初に</Trans>
              </li>
              <li>
                <a href="https://typescriptbook.jp/" target="_blank" rel="noreferrer">
                  サバイバル TypeScript
                </a>{' '}
                — <Trans>型が読めないと先に進みにくい</Trans>
              </li>
              <li>
                <a
                  href="https://gihyo.jp/book/2026/978-4-297-15438-7"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Trans>Web開発者のための［入門］Cloudflare Workers</Trans>
                </a>{' '}
                — <Trans>本気で使うなら</Trans>
              </li>
              <li>
                <a
                  href="https://gihyo.jp/book/2026/978-4-297-15678-7"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Trans>Cloudflare Workers 実践ガイド</Trans>
                </a>{' '}
                — <Trans>設計・運用まで</Trans>
              </li>
            </ul>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default function HomePage({ locale }: Props) {
  const i18n = useMemo(
    () => new I18n({ locale, messages: { [locale]: catalogs[locale] } }),
    [locale],
  );

  return (
    <I18nProvider i18n={i18n}>
      <Playground locale={locale} />
    </I18nProvider>
  );
}
