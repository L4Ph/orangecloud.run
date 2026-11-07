# Learn Cloudflare Workers by running them

Beginner tutorial and playground for Cloudflare Workers and its ecosystem.

## Run

```sh
npm install
npm run dev
```

## Checks

```sh
npm run check   # format, lint (type-aware), type check
```

## Routes

- `/` — index of chapters (run) and articles (read)
- `/lessons/:id` — chapter with the editor
- `/docs/:slug` — long-form articles

## Content

- `lessons/index.ts` — chapter metadata and snippets
- `lessons/docs/{locale}/*.md` — chapter notes
- `lessons/code/*` — snippets the playground runs
- `docs/index.ts`, `docs/content/{locale}/*.md` — articles
- `locales/{locale}/messages.po` — UI strings

## Containers

The Containers chapters run Python, Node.js and shell scripts in a Docker image (`Dockerfile.sandbox`). Run Docker locally to use it.

## Deploy

```sh
npx void connect --platform cloudflare   # pick the account (also enables local Workers AI)
npx void deploy
npx void secret put TURNSTILE_SECRET
```
