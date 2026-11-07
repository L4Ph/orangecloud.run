import { renderToString } from "react-dom/server";
import { Link, Script, ViteClient } from "vite-ssr-components/react";
import { App, type PageData } from "./app";

export type Head = {
  title?: string;
  meta?: Array<{ name?: string; property?: string; content: string }>;
};

// Kumo switches themes with data-mode; set it before first paint so dark mode does not flash.
const darkModeScript =
  "document.documentElement.dataset.mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'";

// The page data sits in a JSON script. Escaping "<" keeps "</script>" in the content from closing it.
const serialize = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");

function Document({ page, head }: { page: PageData; head: Head }) {
  return (
    <html lang={page.props.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {head.title && <title>{head.title}</title>}
        {head.meta?.map((meta) => (
          <meta key={meta.name ?? meta.property} {...meta} />
        ))}
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
        <ViteClient />
        <Link href="/lib/app.css" rel="stylesheet" />
        <Script src="/src/client.tsx" />
      </head>
      <body>
        <div id="root">
          <App page={page} />
        </div>
        <script
          id="page-data"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: serialize(page) }}
        />
      </body>
    </html>
  );
}

export function renderPage(page: PageData, head: Head) {
  return "<!DOCTYPE html>" + renderToString(<Document page={page} head={head} />);
}
