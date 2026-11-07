## Cloudflare

- This project is a Hono app on Cloudflare Workers, configured with `cloudflare.config.ts` and deployed with the `cf` CLI (Cloudflare's CLI, in beta). It does not use Wrangler.
- Run `cf cli search "<what you want to do>"` to find a command, and `cf docs search "<question>"` for the documentation.
- `.cloudflare/types/index.d.ts` is generated from `cloudflare.config.ts` on every dev server start and build. It types `env` and `ctx.exports`, so do not declare binding types by hand. Add the binding to the config instead.
