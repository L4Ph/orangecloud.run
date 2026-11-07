import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link } from "@cloudflare/kumo/components/link";
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { lessonSections } from "../lessons";
import { catalog, catalogSections, entryOf, neighbours } from "../lib/catalog";
import { SiteHeader } from "./site-header";
import type { Locale } from "../lib/locales";

// Every chapter and article uses this frame, so the sidebar, the heading and
// the previous/next links look and behave the same. Only the window scrolls;
// the sidebar and the side columns are sticky.

// A filled dot marks a hands-on chapter, an outlined one marks an article.
export function KindDot({ run, className = "" }: { run: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`size-2 shrink-0 rounded-full ${
        run ? "bg-kumo-brand" : "border-[1.5px] border-kumo-subtle"
      } ${className}`}
    />
  );
}

export function Kind({ run }: { run: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <KindDot run={run} />
      {run ? <Trans>動かす</Trans> : <Trans>読む</Trans>}
    </span>
  );
}

// Links that leave the site open in a new tab, so say so for everyone.
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRightIcon aria-hidden size={12} className="ml-0.5 shrink-0" />
      <span className="sr-only">
        <Trans>（新しいタブで開く）</Trans>
      </span>
    </Link>
  );
}

function ChapterList({ activeKey }: { activeKey: string }) {
  const { t, i18n } = useLingui();
  // The list is rendered twice (sidebar and the menu on small screens).
  const uid = useId();

  return (
    <nav aria-label={t`章と記事`} className="space-y-5">
      {catalogSections.map((section) => {
        const labelId = `${uid}-${section.id}`;
        return (
          <div key={section.id} role="group" aria-labelledby={labelId}>
            <p id={labelId} className="mb-1 px-2 text-xs text-kumo-subtle">
              {i18n._(section.title)}
            </p>
            <ul className="space-y-0.5">
              {catalog
                .filter((entry) => entry.section === section.id)
                .map((entry) => {
                  const active = entry.key === activeKey;
                  return (
                    <li key={entry.key}>
                      {/* Kumo's Link is inline-flex and centres its items; override both so
                          the whole row is the target and the dot sits on the first line. */}
                      <Link
                        href={entry.href}
                        variant={active ? "current" : "plain"}
                        aria-current={active ? "page" : undefined}
                        className={`!flex w-full !items-start !gap-2 rounded-md px-2 py-2 leading-5 !no-underline max-lg:py-3 ${
                          active
                            ? "bg-kumo-tint !text-kumo-strong"
                            : "!text-kumo-subtle transition-colors hover:bg-kumo-tint/60 hover:!text-kumo-strong"
                        }`}
                      >
                        <KindDot run={entry.run} className="mt-1.5" />
                        <span className="sr-only">
                          {entry.run ? <Trans>動かす</Trans> : <Trans>読む</Trans>}
                        </span>
                        {i18n._(entry.title)}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Sidebar({ activeKey }: { activeKey: string }) {
  const box = useRef<HTMLDivElement>(null);

  // The list is taller than a short window: bring the current page into view.
  useEffect(() => {
    const scroller = box.current;
    const current = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !current) return;
    const offset = current.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset < 0 || offset + current.offsetHeight > scroller.clientHeight) {
      scroller.scrollTop += offset - (scroller.clientHeight - current.offsetHeight) / 2;
    }
  }, [activeKey]);

  return (
    // -mx-1/px-1 leaves room for the focus ring, which the scroller would clip.
    <div
      ref={box}
      className="sticky top-14 -mx-1 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain px-1 py-6 [scrollbar-width:thin] lg:block"
    >
      <ChapterList activeKey={activeKey} />
    </div>
  );
}

export function ContentShell({
  locale,
  activeKey,
  children,
}: {
  locale: Locale;
  activeKey: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-kumo-canvas text-sm text-kumo-default">
      <SiteHeader locale={locale} />
      <div className="mx-auto grid w-full max-w-[1600px] px-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-8 lg:px-6">
        <Sidebar activeKey={activeKey} />
        <main id="main" className="min-w-0 py-6 lg:py-8">
          {/* Re-keyed on navigation so the menu closes after you pick a page. */}
          <details
            key={activeKey}
            className="mb-6 rounded-lg bg-kumo-base ring ring-kumo-line lg:hidden"
          >
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-kumo-strong">
              <Trans>章と記事の一覧</Trans>
            </summary>
            <div className="border-t border-kumo-line px-2 py-3">
              <ChapterList activeKey={activeKey} />
            </div>
          </details>
          {children}
        </main>
      </div>
    </div>
  );
}

export function ChapterHeader({
  activeKey,
  children,
}: {
  activeKey: string;
  children?: ReactNode;
}) {
  const { i18n } = useLingui();
  const entry = entryOf(activeKey);
  const section = lessonSections.find((item) => item.id === entry.section);

  return (
    <header>
      <p className="flex items-center gap-2 text-xs text-kumo-subtle">
        <Kind run={entry.run} />
        <span aria-hidden>·</span>
        {section && <span>{i18n._(section.title)}</span>}
      </p>
      <h1 className="mt-2 text-2xl leading-tight font-semibold text-kumo-strong">
        {i18n._(entry.title)}
      </h1>
      <p className="mt-1 max-w-2xl text-kumo-subtle">{i18n._(entry.summary)}</p>
      {children}
    </header>
  );
}

function Neighbour({
  entry,
  direction,
}: {
  entry: (typeof catalog)[number] | undefined;
  direction: "previous" | "next";
}) {
  const { i18n } = useLingui();
  const next = direction === "next";
  if (!entry) return <span />;

  return (
    <Link
      href={entry.href}
      variant="plain"
      className={`flex min-w-0 flex-col gap-0.5 rounded-lg bg-kumo-base px-4 py-3 ring ring-kumo-line transition-colors hover:bg-kumo-tint ${
        next ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <span className="flex items-center gap-1 text-xs text-kumo-subtle">
        {!next && <ArrowLeftIcon size={12} />}
        {next ? <Trans>次</Trans> : <Trans>前</Trans>}
        {next && <ArrowRightIcon size={12} />}
      </span>
      <span className="max-w-full truncate font-medium text-kumo-strong">
        {i18n._(entry.title)}
      </span>
    </Link>
  );
}

export function ChapterFooter({
  activeKey,
  className = "",
}: {
  activeKey: string;
  className?: string;
}) {
  const { t, i18n } = useLingui();
  const { index, previous, next } = neighbours(activeKey);

  return (
    <footer className={`max-w-[680px] border-t border-kumo-line pt-6 ${className}`}>
      <nav aria-label={t`前後の章`} className="grid grid-cols-2 gap-3">
        <Neighbour entry={previous} direction="previous" />
        <Neighbour entry={next} direction="next" />
      </nav>
      <p className="mt-2 text-center text-xs text-kumo-subtle tabular-nums">
        {index + 1} / {catalog.length}
      </p>

      <p className="mt-8 mb-2 text-sm font-semibold text-kumo-strong">
        <Trans>前提知識</Trans>
      </p>
      <ul className="list-disc space-y-2 pl-5 text-kumo-default">
        <li>
          <ExternalLink href="https://jsprimer.net/">JavaScript Primer</ExternalLink> —{" "}
          <Trans>JS がはじめてなら最初に</Trans>
        </li>
        <li>
          <ExternalLink href="https://typescriptbook.jp/">サバイバルTypeScript</ExternalLink> —{" "}
          <Trans>型が読めないと先に進みにくい</Trans>
        </li>
      </ul>
      {i18n.locale !== "ja" && (
        <p className="mt-2 text-xs text-kumo-subtle">
          <Trans>どちらも日本語の本です。</Trans>
        </p>
      )}
      <p className="mt-4">
        <Link href="/books" className="inline-flex min-h-10 items-center">
          <Trans>書籍の紹介 →</Trans>
        </Link>
      </p>
    </footer>
  );
}
