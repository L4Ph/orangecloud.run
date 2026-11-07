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
npm run smoke   # execute every lesson snippet against the dev server
```

## Routes

- `/lessons` — hands-on chapters, `/lessons/:id` opens the editor
- `/docs` — long-form articles, `/docs/:slug`

## Content

- `lessons/index.ts` — chapter metadata and snippets
- `lessons/docs/{locale}/*.md` — chapter notes
- `lessons/code/*.js` — snippets the playground runs
- `docs/index.ts`, `docs/content/{locale}/*.md` — articles
- `locales/{locale}/messages.po` — UI strings

## Deploy

```sh
npx void connect --platform cloudflare   # pick the account (also enables local Workers AI)
npx void deploy
npx void secret put TURNSTILE_SECRET
```
