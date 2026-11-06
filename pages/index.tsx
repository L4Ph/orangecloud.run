import { useCallback, useEffect, useRef, useState } from 'react';
import { fetch as apiFetch } from 'void/client';
import { marked } from 'marked';
import { lessons } from '../lessons';
import './style.css';

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

export default function HomePage() {
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];

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

  const docHtml = marked.parse(lesson.doc, { async: false });

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <strong>Cloudflare Workers を動かして学ぶ</strong>
          <span>チュートリアル兼プレイグラウンド</span>
        </div>
        <nav className="tabs" aria-label="単元">
          {lessons.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={item.id === lesson.id ? 'tab active' : 'tab'}
              onClick={() => setLessonId(item.id)}
              title={item.summary}
            >
              {index + 1}. {item.title}
            </button>
          ))}
        </nav>
      </header>

      <main className="split">
        <section className="pane editor-pane" aria-label="エディタ">
          <div className="pane-head">
            <div>
              <h1>{lesson.title}</h1>
              <p>{lesson.summary}</p>
            </div>
            <div className="controls">
              <button type="button" onClick={run} disabled={!lesson.runnable || pending}>
                {pending ? '実行中…' : '実行 ⌘/Ctrl+Enter'}
              </button>
              <button type="button" className="ghost" onClick={() => setCode(lesson.code)}>
                初期化
              </button>
            </div>
          </div>

          {lesson.hint && <p className="hint">{lesson.hint}</p>}

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
                  HTTP {result.status} · {result.ms}ms
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
                {lesson.runnable
                  ? '実行するとここにレスポンスと console の出力が出ます。ネットワークは塞がれていて、壊しても何も起きません。'
                  : 'この単元は資料のみです。コードは参考として置いています。'}
              </p>
            )}
          </div>
        </section>

        <section className="pane doc-pane" aria-label="資料">
          <article className="doc" dangerouslySetInnerHTML={{ __html: docHtml }} />
          <footer className="doc-footer">
            <p>前提知識</p>
            <ul>
              <li>
                <a href="https://jsprimer.net/" target="_blank" rel="noreferrer">
                  JavaScript Primer
                </a>{' '}
                — JS がはじめてなら最初に
              </li>
              <li>
                <a href="https://typescriptbook.jp/" target="_blank" rel="noreferrer">
                  サバイバル TypeScript
                </a>{' '}
                — 型が読めないと先に進みにくい
              </li>
              <li>
                <a
                  href="https://gihyo.jp/book/2026/978-4-297-15438-7"
                  target="_blank"
                  rel="noreferrer"
                >
                  Web開発者のための［入門］Cloudflare Workers
                </a>{' '}
                — 本気で使うなら
              </li>
              <li>
                <a
                  href="https://gihyo.jp/book/2026/978-4-297-15678-7"
                  target="_blank"
                  rel="noreferrer"
                >
                  Cloudflare Workers 実践ガイド
                </a>{' '}
                — 設計・運用まで
              </li>
            </ul>
          </footer>
        </section>
      </main>
    </div>
  );
}
