import { useCallback, useEffect, useId, useRef, useState } from "react";
import { fetch as apiFetch } from "void/client";
import { I18nPage } from "./i18n-page";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@cloudflare/kumo/components/button";
import { Link } from "@cloudflare/kumo/components/link";
import { ArrowDownIcon, PlayIcon } from "@phosphor-icons/react";
import { lessons } from "../lessons";
import { Turnstile } from "./turnstile";
import type { Locale } from "./locales";
import { ChapterFooter, ChapterHeader, ContentShell } from "./content-shell";
import { MarkdownArticle } from "./markdown-article";
import type { MarkdownDocument } from "@tanstack/markdown";

type RunResult = {
  status: number;
  body: string;
  logs: string[];
  ms: number;
  error?: string;
  errorCode?: "turnstile";
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
  language: "javascript" | "shell" | "python";
  label: string;
  onRun: () => void;
}) {
  const [ready, setReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    let disposed = false;
    const disposables: { dispose: () => void }[] = [];

    void (async () => {
      const [monaco, editorWorker] = await Promise.all([
        import("monaco-editor/editor/editor.api"),
        import("monaco-editor/editor/editor.worker?worker"),
        import("monaco-editor/languages/definitions/javascript/register"),
        import("monaco-editor/languages/definitions/shell/register"),
        import("monaco-editor/languages/definitions/python/register"),
      ]);
      if (disposed || !host.current) return;

      (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
        getWorker: () => new editorWorker.default(),
      };

      const scheme = window.matchMedia("(prefers-color-scheme: dark)");
      const editor = monaco.editor.create(host.current, {
        value,
        language,
        theme: scheme.matches ? "vs-dark" : "vs",
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 14, bottom: 14 },
        renderLineHighlight: "none",
        smoothScrolling: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        ariaLabel: label,
      });
      editorRef.current = editor;
      setReady(true);
      disposables.push(
        editor.onDidChangeModelContent(() => {
          onChangeRef.current(editor.getValue());
        }),
      );
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunRef.current();
      });

      // Tab indents here, which would trap keyboard users: Esc hands Tab back to the page
      // until the editor loses focus. Open widgets keep their own Esc.
      editor.addCommand(
        monaco.KeyCode.Escape,
        () => editor.updateOptions({ tabFocusMode: true }),
        "!suggestWidgetVisible && !findWidgetVisible && !parameterHintsVisible && !renameInputVisible",
      );
      disposables.push(
        editor.onDidBlurEditorText(() => editor.updateOptions({ tabFocusMode: false })),
      );

      // The rest of the page follows the OS theme; keep the editor in step.
      const syncTheme = () => monaco.editor.setTheme(scheme.matches ? "vs-dark" : "vs");
      scheme.addEventListener("change", syncTheme);
      disposables.push({ dispose: () => scheme.removeEventListener("change", syncTheme) });
    })();

    return () => {
      disposed = true;
      disposables.forEach((item) => item.dispose());
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
    void import("monaco-editor/editor/editor.api").then((monaco) => {
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
        const data: RunResult = await apiFetch("/api/run", {
          method: "POST",
          body: {
            code: value,
            ...(lesson.runner === "durable-object"
              ? { lang: "durable-object" as const }
              : lesson.runner === "container"
                ? {
                    lang: "container" as const,
                    runtime:
                      ({ python: "python", shell: "sh" } as const)[
                        lesson.language as "python" | "shell"
                      ] ?? ("node" as const),
                  }
                : lesson.language === "python"
                  ? { lang: "python" as const }
                  : {}),
            ...(turnstileToken ? { token: turnstileToken } : {}),
          },
          timeout: 20_000,
        });
        if (data.errorCode === "turnstile" && !turnstileToken) {
          // No pass cookie yet: ask Turnstile once, then retry with its token.
          setAwaitingToken(true);
        } else if (data.errorCode === "turnstile") {
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

  const key = `lesson-${lesson.id}`;
  const consoleId = useId();
  const consoleBody = useRef<HTMLDivElement>(null);

  // A new run starts at the top of the output.
  useEffect(() => {
    consoleBody.current?.scrollTo({ top: 0 });
  }, [result, error]);

  const statusLine = result ? (
    lesson.runner === "container" ? (
      <Trans>
        exit {result.status} · {result.ms}ms
      </Trans>
    ) : (
      <Trans>
        HTTP {result.status} · {result.ms}ms
      </Trans>
    )
  ) : null;

  return (
    <ContentShell locale={locale} activeKey={key}>
      {awaitingToken && <Turnstile key={widgetKey} onToken={setToken} />}

      {/* One reading order: text, editor, footer. From xl the text and footer stack on the
          left while the editor stays pinned on the right, so it never leaves the window. */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:grid-rows-[auto_1fr] xl:items-start">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <ChapterHeader activeKey={key}>
            <p className="mt-2 xl:hidden">
              <Link href="#editor" className="inline-flex min-h-10 items-center gap-1">
                <ArrowDownIcon aria-hidden size={14} />
                <Trans>エディタへ移動</Trans>
              </Link>
            </p>
          </ChapterHeader>
          <MarkdownArticle document={doc} className="mt-8" />
        </div>

        {/* The editor shows about 20 lines (20 × 20px plus padding) and the console gets the
            rest of the panel. The panel's height depends only on the window, never on the
            code or the output, and each part scrolls inside itself. */}
        <section
          id="editor"
          aria-label={t`エディタ`}
          className="flex h-[min(calc(100dvh-4rem),46rem)] scroll-mt-20 flex-col overflow-hidden rounded-lg bg-kumo-base ring ring-kumo-line xl:sticky xl:top-22 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:h-[min(calc(100dvh-7.5rem),52rem)]"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-kumo-line px-3 py-2">
            <p className="text-xs text-kumo-subtle max-md:hidden [@media(hover:none)]:hidden">
              <Trans>Esc → Tab でエディタの外へ</Trans>
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCode(lesson.code)}>
                <Trans>初期化</Trans>
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<PlayIcon size={16} />}
                loading={pending}
                onClick={run}
                disabled={!lesson.runnable}
              >
                <Trans>実行</Trans>
                <kbd className="ml-2 font-sans text-xs [@media(hover:none)]:hidden">
                  ⌘/Ctrl+Enter
                </kbd>
              </Button>
            </div>
          </div>

          {lesson.hint && (
            <p className="mx-3 mt-3 shrink-0 rounded-md bg-kumo-recessed px-3 py-2 text-xs text-kumo-subtle">
              {i18n._(lesson.hint)}
            </p>
          )}

          <div className="min-h-40 shrink grow-0 basis-[428px] overscroll-contain">
            <CodeEditor
              value={code}
              onChange={setCode}
              language={lesson.language ?? "javascript"}
              label={t`コードエディタ。Esc のあと Tab でエディタの外へ移動します。`}
              onRun={run}
            />
          </div>

          <div className="flex min-h-40 flex-1 flex-col border-t border-kumo-line">
            <div className="flex shrink-0 items-baseline justify-between gap-3 px-4 pt-3 pb-2">
              <h2 id={consoleId} className="text-sm font-medium text-kumo-strong">
                <Trans>実行結果</Trans>
              </h2>
              {statusLine && (
                <p aria-hidden className="text-xs text-kumo-subtle tabular-nums">
                  {statusLine}
                </p>
              )}
            </div>
            <div
              ref={consoleBody}
              role="status"
              aria-labelledby={consoleId}
              className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-4 font-mono text-[13px] leading-5"
            >
              {error && (
                <pre role="alert" className="break-words whitespace-pre-wrap text-kumo-danger">
                  {error}
                </pre>
              )}
              {result && (
                <>
                  <p className="sr-only">{statusLine}</p>
                  <pre className="break-words whitespace-pre-wrap text-kumo-default">
                    {result.body}
                  </pre>
                  {result.logs.length > 0 && (
                    <>
                      <p className="mt-4 mb-1 font-sans text-xs text-kumo-subtle">console</p>
                      <pre className="break-words whitespace-pre-wrap text-kumo-default">
                        {result.logs.join("\n")}
                      </pre>
                    </>
                  )}
                </>
              )}
              {!error && !result && (
                <p className="font-sans text-sm text-kumo-subtle">
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
          </div>
        </section>

        <ChapterFooter activeKey={key} className="xl:col-start-1 xl:row-start-2" />
      </div>
    </ContentShell>
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
