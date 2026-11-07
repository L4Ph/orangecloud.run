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
  env: {
    KV: ctx.exports.LessonKv({ props: { prefix: "playground/" } }),
    DB: ctx.exports.LessonDb({ props: {} }),
  },
  globalOutbound: null, // Block all outbound communication to external networks
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **Complete Isolation via `globalOutbound: null`**: From within the child Worker, `fetch()` calls or raw socket establishment to any server on the internet are strictly prohibited. This physically blocks unauthorized external communication or credential theft by malicious scripts.
- **Strict Resource Limits**: CPU execution time is limited to a maximum of 100ms. Even if code containing infinite loops or excessive computations is submitted, only the child isolate is terminated without exhausting the parent Worker's resources.
- **isolate Cache Reuse**: Using `env.LOADER.get(id, factory)`, existing isolates are reused for the same code (code with matching hash values). This prevents wasteful memory reallocation and minimizes cost and latency.

## Binding Injection Boundaries

The child Worker's `env` accepts only two kinds of values: data that supports Structured Cloning, and Service Bindings. D1, KV, R2, AI and Durable Object stubs are neither, so none of them can be passed in directly. Putting them in `env` fails on the deployed runtime with `This ServiceStub cannot be serialized.`

Instead, the parent Worker exports a `WorkerEntrypoint` class for each binding and hands the child a stub of it (`ctx.exports.LessonKv({ props })`). The child calls `env.KV.get()` like any binding, and each call is an RPC back into the parent, which runs it against the real resource. The classes live in `lib/lesson-bindings.ts`.

| Resource        | What the child Worker gets                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| KV / R2         | `LessonKv` / `LessonR2`. Keys are fenced under `props.prefix`, so a lesson cannot touch the app's other keys |
| D1 Database     | `LessonDb`. The chain `prepare(sql).bind(...).run()` returns a further stub at each step                     |
| Workers AI      | `LessonAi`. One model and a small input only, because every run is billed                                    |
| Durable Objects | `LessonCounter`. A stub that forwards to the Durable Object                                                  |

The child sees only these five stubs. It cannot reach the parent's `env`, its `ctx`, or any method the class does not list. Each call counts as a subrequest, limited to 20 per run.

## Multi-Tenant Execution Defense Lines

1. **Prevention of Implicit Cache Contamination**: Whitespace and line breaks within the code are normalized before hash values are calculated to prevent unintended cache splitting.
2. **Overload Prevention via Rate Limiting**: Calls to the execution endpoint are limited per client IP (containers get a tighter limit) to prevent overload attacks by automated scripts. The limits are approximate and counted separately in each Cloudflare location.
3. **Cost Barrier**: Dynamic Workers are billed based on "the number of unique Workers generated per day." The design ensures that the number of unique Workers subject to billing is kept to a minimum by having many users share the initial state of the educational code.
