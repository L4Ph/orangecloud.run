# Deployment and Operations at the Edge

Deploy code verified in a local simulator (Miniflare) to hundreds of edge data centers worldwide. Use **cf**, Cloudflare's official CLI (beta), to sync your configuration and build output to the global network. Because cf is in beta, its commands and configuration may change. Wrangler also works, and Cloudflare's official getting-started guide still assumes Wrangler. This site uses cf.

## Basic Development and Deployment Cycle

```sh
# Initial authentication (browser launches and account linking)
cf auth login

# Verify operation via local emulator (fast feedback)
cf dev

# Production deployment to edge networks
cf deploy
```

Create a new project with `cf init my-worker`. It starts with `cloudflare.config.ts`, type definitions, and `dev` / `build` / `deploy` scripts. Convert an existing Wrangler project to `cloudflare.config.ts` with `cf migrate`.

## Connecting Sensitive Information and External Resources

Directly committing API keys or signing secrets within the codebase is strictly prohibited. There is a clear boundary between "static settings that may be exposed (`bindings.text()` / `bindings.json()`)" and "sensitive information that should be stored encrypted (secrets, declared with `bindings.secret()`)" in environment variables.

```sh
# Register encrypted secrets (values are hidden even on the dashboard)
cf workers secrets update STRIPE_API_KEY --worker my-worker --type secret_text --text <SECRET_VALUE>

# Find the command to create a D1 database from a description
cf cli search "create a D1 database"

# Apply production migrations (cf takes the database ID and applies to the remote by default)
cf d1 migrations apply <DATABASE_ID>
```

Use `cf workers secrets update` to register one secret at a time with `cf`. It calls the same API as `wrangler secret put`, but because the value is passed as an argument, it stays in the shell history. To pass the value through standard input, use `npx wrangler secret put`. To pass secrets together with a deploy, use `cf deploy --secrets-file <PATH>` (JSON or .env). `$VAR` in a .env file is expanded, so write `\$` for a value that contains `$`.

Connection settings for resources are written, typed, in `cloudflare.config.ts` at the project root (with builders such as `bindings.d1()`). Local development reads the same definition, so you can keep using the same `env.DB` and `env.KV` interfaces as in production.

## Boundary Checks Before Deployment

- **Secret Separation**: Are API tokens or private keys left in plaintext in `bindings.text()` / `bindings.json()` in `cloudflare.config.ts`, or in source code?
- **Exact Matching of Binding Names**: Are there any discrepancies between the `env` property names referenced in the source code and the key names written in `env` in `cloudflare.config.ts`?
- **Consideration of CPU Limits**: Could external data processing or heavy looping exceed the plan's time limits (10ms for free tier, 30 seconds by default for paid tier, up to 5 minutes) and lead to forced termination?
- **Tail Logging Monitoring**: Verify real traffic right after deployment by watching standard output logs from the edge in real time. `cf` does not support this yet, so use `npx wrangler tail <WORKER_NAME>`.
