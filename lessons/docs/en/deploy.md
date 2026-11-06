# Deploying

Once it runs locally, the last step is shipping it to your own account.

## Steps

```sh
# 1. Log in to Cloudflare (opens a browser)
npx void cloudflare login

# 2. Store production secrets (.env is never uploaded)
npx void secret put MY_API_KEY

# 3. Deploy (the first run picks account and resources)
npx void deploy --platform cloudflare
```

The first deploy creates resources such as D1 and records them in `void.lock.json`. **Commit that file** — it holds the migration history.

## Check before deploying

- [ ] Secrets live in the `env.ts` schema plus `void secret put`; never in code
- [ ] Binding names such as `env.DB` are the same in production
- [ ] No infinite loops (CPU limits kill them, but requests fail meanwhile)
- [ ] No unexpectedly huge responses
- [ ] You can read the bill (dashboard Usage)

## After it is public

- Attach a custom domain (Workers Custom Domain)
- Watch logs (`cf` CLI or the dashboard; the `wrangler tail` equivalent)
- Add caching (Cache API / static assets) when traffic grows

## How this site is built

This site runs on **Void (Vite+) + Cloudflare Workers**. The code in the left editor is executed per request by **Dynamic Workers** (a Worker created at runtime) with networking blocked, so nothing you write can break it.

- Execution: `env.LOADER` (Worker Loader binding)
- Per-run limits: 100ms CPU, no outbound network
- KV / R2 / AI are proxied through Durable Objects (isolates cannot receive them)
- D1 and Durable Objects are passed as real bindings
