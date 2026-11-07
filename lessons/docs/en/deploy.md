# Deploying

Once it runs locally, ship it to your Cloudflare account. This chapter uses Wrangler, the official CLI.

## Steps

```sh
# 1. Log in (opens a browser)
npx wrangler login

# 2. Check it locally
npx wrangler dev

# 3. Deploy
npx wrangler deploy
```

For a fresh project, `npm create cloudflare@latest` starts you from a template.

## Secrets and resources

```sh
# Keep API keys out of code: store them as Worker secrets
npx wrangler secret put API_KEY

# D1 database
npx wrangler d1 create my-db
npx wrangler d1 migrations apply my-db --remote

# KV / R2 / Queues are created the same way, then bound in wrangler.jsonc
```

Bindings live in `wrangler.jsonc`. Locally, Miniflare reads the same file, so your code uses `env.DB` and friends exactly as it will in production.

## Check before deploying

- [ ] Secrets are in `wrangler secret put`, never in code or `vars`
- [ ] Binding names match production (`wrangler.jsonc`)
- [ ] No infinite loops (CPU limits kill them, but requests fail meanwhile)
- [ ] No unexpectedly huge responses
- [ ] You can read the bill (dashboard Usage)

## After it is public

- Attach a custom domain (Workers Custom Domain)
- Watch logs: `npx wrangler tail`
- Add caching (Cache API / static assets) when traffic grows
