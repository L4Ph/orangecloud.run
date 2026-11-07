import { useCallback, useEffect, useId, useRef, useState } from "react";
import { I18nPage } from "./i18n-page";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@cloudflare/kumo/components/button";
import { Link } from "@cloudflare/kumo/components/link";
import { ArrowDownIcon, PlayIcon } from "@phosphor-icons/react";
import { lessons } from "../lessons";
import type { Locale } from "../lib/locales";
import { ChapterFooter, ChapterHeader, ContentShell } from "./content-shell";
import { MarkdownArticle } from "./markdown-article";
import { editorCss } from "../lib/markdown-highlight";
import type { MarkdownDocument } from "@tanstack/markdown";

type RunResult = {
  status: number;
  body: string;
  logs: string[];
  ms: number;
  error?: string;
};

// Only the lesson's language is fetched, so a shell lesson never downloads the JS parser.
const languages = {
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  // There is no official CodeMirror language package for shell (the community Lezer grammar
  // @fig/lezer-bash was last published in 2023), so it is the one language left on a stream parser.
  shell: () =>
    Promise.all([
      import("@codemirror/language"),
      import("@codemirror/legacy-modes/mode/shell"),
    ]).then(([{ StreamLanguage }, { shell }]) => StreamLanguage.define(shell)),
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
  const editorRef = useRef<{
    view: import("@codemirror/view").EditorView;
    replace: (next: string) => void;
  } | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  valueRef.current = value;
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    let disposed = false;

    void (async () => {
      const [
        { EditorState, Transaction },
        { EditorView, keymap, lineNumbers },
        { defaultKeymap, history, historyKeymap },
        { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting },
        { closeBrackets, closeBracketsKeymap },
        { tags },
        languageSupport,
      ] = await Promise.all([
        import("@codemirror/state"),
        import("@codemirror/view"),
        import("@codemirror/commands"),
        import("@codemirror/language"),
        import("@codemirror/autocomplete"),
        import("@lezer/highlight"),
        languages[language](),
      ]);
      if (disposed || !host.current) return;

      const view = new EditorView({
        parent: host.current,
        doc: valueRef.current,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          EditorView.lineWrapping,
          EditorState.tabSize.of(2),
          languageSupport,
          // Same palette as the article's code blocks; the variables come from editorCss, which
          // also follows the page's light/dark switch.
          syntaxHighlighting(
            HighlightStyle.define([
              { tag: tags.keyword, color: "var(--th-keyword)" },
              { tag: [tags.string, tags.regexp], color: "var(--th-string)" },
              { tag: [tags.number, tags.atom, tags.bool], color: "var(--th-number)" },
              { tag: tags.comment, color: "var(--th-comment)" },
              {
                tag: [
                  tags.definition(tags.variableName),
                  tags.function(tags.variableName),
                  tags.function(tags.propertyName),
                ],
                color: "var(--th-function)",
              },
              { tag: tags.standard(tags.variableName), color: "var(--th-command)" },
              { tag: [tags.typeName, tags.className], color: "var(--th-type)" },
              { tag: tags.meta, color: "var(--th-meta)" },
            ]),
          ),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.theme({
            "&": { height: "100%", color: "var(--th-token)" },
            "&.cm-focused": { outline: "2px solid var(--th-attr)", outlineOffset: "-2px" },
            ".cm-scroller": { overflow: "auto", fontFamily: "inherit", lineHeight: "inherit" },
            ".cm-content": { padding: "14px 0", caretColor: "currentColor" },
            ".cm-line": { padding: "0 16px" },
            ".cm-gutters": {
              backgroundColor: "transparent",
              border: "none",
              color: "var(--th-comment)",
            },
          }),
          // Tab is left unbound on purpose: binding it to indent traps keyboard users (WCAG 2.1.2)
          // and then needs a hint explaining the way out. Mod-[ and Mod-] indent instead.
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                onRunRef.current();
                return true;
              },
            },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      });
      editorRef.current = {
        view,
        // A replacement from outside (reset, next lesson) is not something Ctrl+Z should undo.
        replace: (next) =>
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: next },
            annotations: Transaction.addToHistory.of(false),
          }),
      };
      setReady(true);
    })();

    return () => {
      disposed = true;
      editorRef.current?.view.destroy();
      editorRef.current = null;
      setReady(false);
    };
  }, [language, label]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.view.state.doc.toString() !== value) editor.replace(value);
  }, [value]);

  return (
    <div className="relative h-full w-full font-mono text-[13px] leading-5">
      <style>{editorCss}</style>
      <div className="h-full w-full" ref={host} />
      {/* Same text while the editor downloads, so the pane is never an empty box. */}
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

  useEffect(() => {
    setCode(lesson.code);
    setResult(null);
    setError(null);
  }, [lesson.id, lesson.code]);

  const execute = useCallback(
    async (value: string) => {
      setPending(true);
      setError(null);
      try {
        const response = await fetch("/api/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
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
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (response.status === 429) {
          setResult(null);
          setError(t`実行回数が多すぎます。少し待ってからもう一度お試しください。`);
          return;
        }
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data: RunResult = await response.json();
        if (data.error) {
          setResult(null);
          setError(data.error);
        } else {
          setResult(data);
        }
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(false);
      }
    },
    [lesson.language, lesson.runner, t],
  );

  const run = useCallback(() => {
    if (!lesson.runnable || pending) return;
    void execute(code);
  }, [code, execute, lesson.runnable, pending]);

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

  // Storage chapters write to KV, R2, D1 and Durable Objects, and every visitor shares that state.
  const idleHint =
    lesson.section === "storage" ? (
      <Trans>
        実行するとここに結果が出ます。ネットワークは塞がれていますが、D1・KV・R2・Durable Object
        の状態は訪問者全員で共有されます。
      </Trans>
    ) : (
      <Trans>実行するとここに結果が出ます。ネットワークは塞がれています。</Trans>
    );

  return (
    <ContentShell locale={locale} activeKey={key}>
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
              label={t`コードエディタ`}
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
                    idleHint
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
