# Deployment and Operations at the Edge

Deploy code verified in a local simulator (Miniflare) to hundreds of edge data centers worldwide. Use **Wrangler**, Cloudflare's official CLI tool, to instantaneously synchronize configuration files and build artifacts across the global network.

## Basic Development and Deployment Cycle

```sh
# Initial authentication (browser launches and account linking)
npx wrangler login

# Verify operation via local emulator (fast feedback)
npx wrangler dev

# Production deployment to edge networks (typically propagates globally within seconds)
npx wrangler deploy
```

When starting a new project, use the official scaffold `npm create cloudflare@latest` to begin with TypeScript type definitions and recommended configurations pre-configured.

## Connecting Sensitive Information and External Resources

Directly committing API keys or signing secrets within the codebase is strictly prohibited. There is a clear boundary between "static settings that may be exposed (`vars`)" and "sensitive information that should be stored encrypted (`secrets`)" in environment variables.

```sh
# Register encrypted secrets (values are hidden even on the dashboard)
npx wrangler secret put STRIPE_API_KEY

# Create D1 relational database and apply production migrations
npx wrangler d1 create my-production-db
npx wrangler d1 migrations apply my-production-db --remote
```

Connection settings for various resources are described in the `wrangler.jsonc` (or `wrangler.toml`) at the project root. Since Miniflare interprets this definition file during local development, you can continue development using the same `env.DB` and `env.KV` interfaces as in production.

## Boundary Checks Before Deployment

- **Secret Separation**: Are API tokens or private keys left in plaintext within configuration `vars` entries or source code?
- **Exact Matching of Binding Names**: Are there any discrepancies between the `env` property names referenced in the source code and the `binding` definition names in the configuration file?
- **Consideration of CPU Limits**: Could external data processing or heavy looping exceed the plan's time limits (10ms for free tier, 30 seconds for paid tier) and lead to forced termination?
- **Tail Logging Monitoring**: Monitor actual traffic behavior immediately after deployment by running `npx wrangler tail` to track standard output logs from the edge in real time.
