# Learning Environment Architecture (Dynamic Workers)

Traditionally, when building a sandbox to securely execute arbitrary code written by users in a browser, the standard approach was to run a resource-intensive Docker container as the backend. However, the container approach introduces a startup delay of several seconds per execution and incurs high server instance maintenance costs.

This learning environment employs **Dynamic Workers (Worker Loader Binding)** without using containers at all. In response to requests received by a parent Worker, a child V8 isolate is constructed in memory on-demand and discarded within milliseconds.

## Constructing and Starting Dynamic Workers

The parent Worker bundles user-submitted code into modules and instantiates a child Worker via `env.LOADER`.

```ts
const worker = env.LOADER.get(`sandbox-${hash(code)}`, () => ({
  compatibilityDate: "2026-02-24",
  mainModule: "index.js",
  modules: { "index.js": wrapUserCode(code) },
  env: { KV: kvProxyStub, DB: env.DB },
  globalOutbound: null, // Block all outbound communication to external networks
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **Complete Isolation via `globalOutbound: null`**: From within the child Worker, `fetch()` calls or raw socket establishment to any server on the internet are strictly prohibited. This physically blocks unauthorized external communication or credential theft by malicious scripts.
- **Strict Resource Limits**: CPU execution time is limited to a maximum of 100ms. Even if code containing infinite loops or excessive computations is submitted, only the child isolate is terminated without exhausting the parent Worker's resources.
- **isolate Cache Reuse**: Using `env.LOADER.get(id, factory)`, existing isolates are reused for the same code (code with matching hash values). This prevents wasteful memory reallocation and minimizes cost and latency.

## Binding Injection Boundaries

There are restrictions on the objects that can be passed directly to the child Worker's `env`. These are limited to data types that support Structured Cloning and Service Bindings.

| Resource        | How to Pass to Child Worker                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Database     | Passed as-is, as it natively supports Structured Cloning                                                                                 |
| Durable Objects | Passed as stub objects (Service Bindings) obtained via `namespace.get(id)`                                                               |
| KV / R2 / AI    | Since the namespaces themselves cannot be cloned directly, they are relayed via the parent's Durable Object or Service Binding RPC proxy |

For example, in the case of KV, a Durable Object placed in the parent environment handles the `get` / `put` / `delete` / `list` handlers, and its RPC stub is injected into the child environment as `env.KV`. From the child Worker's internal code, this can be accessed transparently as an interface identical to the actual KV namespace.

## Multi-Tenant Execution Defense Lines

1. **Prevention of Implicit Cache Contamination**: Whitespace and line breaks within the code are normalized before hash values are calculated to prevent unintended cache splitting.
2. **Bot Blocking via Turnstile**: Cloudflare Turnstile is validated before the execution endpoint to prevent overload attacks by automated scripts.
3. **Cost Barrier**: Dynamic Workers are billed based on "the number of unique Workers generated per day." The design ensures that the number of unique Workers subject to billing is kept to a minimum by having many users share the initial state of the educational code.
