# How this site works

What the Run button has been doing all along. Everything here is built from Cloudflare features, so you can reuse the shape in your own service.

## A Worker per run

This site uses **Dynamic Workers**. The parent Worker holds `env.LOADER` (the Worker Loader binding) and assembles a child Worker per request.

```ts
const worker = env.LOADER.get(`run-${hash(code)}`, () => ({
  compatibilityDate: '2026-02-24',
  mainModule: 'index.js',
  modules: { 'index.js': wrap(code) },
  env: { KV: kvStub, DB: env.DB },
  globalOutbound: null,
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request('https://sandbox.internal/'));
```

- `load()` is always fresh; `get(id, callback)` reuses an isolate per id
- `globalOutbound: null` blocks the network; `fetch` and `connect` both fail
- `limits` caps CPU and subrequests, so a runaway script cannot outspend one Worker
- `compatibilityDate` / `compatibilityFlags` mean what they mean on a normal Worker

Isolates rather than containers, because they start in milliseconds and are cheap to throw away per request.

## Some bindings can be passed, some cannot

The child's `env` may contain structured-cloneable values and Service Bindings only.

| Binding         | How it is passed                                                          |
| --------------- | ------------------------------------------------------------------------- |
| D1              | As-is (it clones)                                                         |
| Durable Objects | The stub from `namespace.get(id)` (a Service Binding)                     |
| KV / R2 / AI    | The namespace cannot be passed → relay through a Durable Object's methods |

For KV, one Durable Object exposes `get` / `put` / `delete` / `list` and its stub is handed over as `env.KV`. The calling code looks almost like the real namespace.

## Turnstile once per browser

The entry point verifies Turnstile and, on success, sets a signed cookie. Later requests skip the challenge. Tokens are single-use, so each verification needs a new one.

## Where the cost comes from

- Dynamic Workers bill per unique Worker created per day, so the same code reuses the same `get()` id
- CPU is capped at 100ms; waiting is free, so external API calls are cheap
- Pin a cheap Workers AI model and cap the number of runs

## The shape to copy

1. The parent Worker holds the Worker Loader
2. Put user code into `modules` and call `load()` / `get()`
3. Pass only the bindings needed, narrowed through Service Bindings
4. Block outbound network, or restrict it to a relay binding
5. Set CPU and subrequest limits

Those five give you a place to run other people's code safely.
