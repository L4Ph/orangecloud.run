# OrangeCloud.run

Beginner tutorial and playground for Cloudflare Workers and its ecosystem.

Hono on Cloudflare Workers, rendered on the server with React and hydrated in the browser. It is configured with `cloudflare.config.ts` and deployed with the `cf` CLI.

## Run

Requires Node.js `^22.23.0 || ^24.22.0 || ^26.12.0`, the range that `cf` 1.0.0-beta.28 declares in `engines`.

```sh
npm install
npm run dev
```

Workers AI has no local simulation, so `npm run dev` uses the real binding and needs `cf auth login`.

## Checks

```sh
npm run check   # format, lint (type-aware), type check
```

## Layout

- `src/server.tsx` — the Hono app: the page routes and `POST /api/run`
- `src/pages/` — one component per page
- `src/components/` — the header, editor, article and other shared components
- `src/lib/` — catalogs, locale handling, markdown, and the code that runs the editor's input
- `src/durable-objects/` — the Durable Object classes, including the container one
- `src/lessons/`, `src/docs/`, `src/locales/` — content and translations (see Content)

## Routes

All routes are in `src/server.tsx`. Each page route builds its props there and renders a component from `src/pages/`.

- `/` — index of chapters (run) and articles (read)
- `/books` — book recommendations
- `/lessons/:id` — chapter with the editor
- `/docs/:slug` — long-form articles
- `/lessons`, `/docs` — redirect to `/`
- `POST /api/run` — runs the editor's code in a Dynamic Worker, a Durable Object or a container

The sandbox reaches D1, KV, R2, AI and the counter through the `WorkerEntrypoint` classes in `src/lib/lesson-bindings.ts`.

## Content

- `src/lessons/index.ts` — chapter metadata and snippets
- `src/lessons/docs/{locale}/*.md` — chapter notes
- `src/lessons/code/*` — snippets the playground runs
- `src/docs/index.ts`, `src/docs/content/{locale}/*.md` — articles
- `src/locales/{locale}/messages.po` — UI strings

## Containers

The Containers chapters run Python, Node.js and shell scripts in a Docker image (`Dockerfile.sandbox`). Run Docker locally to use it.

## Deploy

```sh
npx cf auth login
npm run deploy   # cf deploy
```

The deploy builds the container image, so Docker must be running.
