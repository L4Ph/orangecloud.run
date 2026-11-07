# Learning Environment Architecture (Dynamic Workers)

Traditionally, when building a sandbox to securely execute arbitrary code written by users in a browser, the standard approach was to run a resource-intensive Docker container as the backend. However, the container approach introduces a startup delay of several seconds per execution and incurs high server instance maintenance costs.

In this learning environment, the JavaScript and Python lessons run on **Dynamic Workers (Worker Loader Binding)** without using containers. In response to requests received by a parent Worker, a child V8 isolate is constructed in memory on-demand and discarded within milliseconds. The Containers chapters and the chapter on writing your own Durable Object run on other runtimes: containers and Durable Objects.

## Constructing and Starting Dynamic Workers

The parent Worker bundles user-submitted code into modules together with a wrapper that always returns a JSON result, and instantiates a child Worker via `env.LOADER`.

```ts
import { exports } from "cloudflare:workers";

// The ID is built from the wrapper version and the SHA-256 of the normalized code (first 128 bits)
const id = `run-${WRAPPER_VERSION}-${await hash(normalize(code))}`;
const worker = env.LOADER.get(id, () => ({
  compatibilityDate: "2026-02-24",
  mainModule: "index.js",
  modules: { "index.js": wrapped, "user.js": code },
  env: {
    KV: exports.LessonKv({ props: { prefix: "playground/" } }),
    STORAGE: exports.LessonR2({ props: { prefix: "playground/" } }),
    AI: exports.LessonAi({ props: {} }),
    COUNTER: exports.LessonCounter({ props: {} }),
    DB: exports.LessonDb({ props: {} }),
  },
  globalOutbound: null, // Block all outbound communication to external networks
  limits: { cpuMs: 100, subRequests: 20 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **Network Cut-off via `globalOutbound: null`**: Both `fetch()` and `connect()` (TCP connections) from the child Worker throw exceptions. The only communication paths to the outside are the five stubs the parent hands over, so unauthorized external communication by malicious scripts is prevented.
- **Resource Limit**: CPU execution time is limited to a maximum of 100ms. Even if code containing infinite loops or excessive computations is submitted, a child Worker that reaches the limit immediately throws an exception.
- **isolate Cache Reuse**: `env.LOADER.get(id, factory)` caches isolates by ID. With the same ID, an existing isolate may be reused, but this is not guaranteed. A Worker that is already loaded is reused without checking its code, so the ID is built from the SHA-256 of the normalized code (the first 128 bits), which keeps different code from getting the same ID.
- **Pinned Compatibility Date**: The Worker in this editor runs with compatibility date 2026-02-24 and without `nodejs_compat`, so `process` does not exist.

## Binding Injection Boundaries

The child Worker's `env` accepts only two kinds of values: data that supports Structured Cloning, and Service Bindings. D1, KV, R2, AI and Durable Object stubs are neither, so none of them can be passed in directly. Putting them in `env` fails with a `DataCloneError`.

Instead, the parent Worker exports a `WorkerEntrypoint` class for each binding and hands the child a stub of it (`exports.LessonKv({ props })`). The child calls `env.KV.get()` like any binding, and each call is an RPC back into the parent, which runs it against the real resource. The classes live in `src/lib/lesson-bindings.ts`.

| Resource        | What the child Worker gets                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KV / R2         | `LessonKv` / `LessonR2`. Keys are fenced under `props.prefix`, so a lesson cannot touch the app's other keys                                              |
| D1 Database     | `LessonDb`. The chain `prepare(sql).bind(...).run()` returns a further stub at each step. There is no prefix fence, and everyone shares the same database |
| Workers AI      | `LessonAi`. One model and a small input only, because every run is billed                                                                                 |
| Durable Objects | `LessonCounter`. A stub that forwards to the Durable Object. The name is fixed, so everyone shares the same counter                                       |

The child sees only these five stubs. It cannot reach the parent's `env`, its `ctx`, or any method the class does not list. Calls through a Service Binding count toward the subrequest limit, so each run is limited to 20.

## Multi-Tenant Execution Defense Lines

1. **Preventing Cache Splitting**: Line endings are converted from CRLF to LF and trailing newlines are trimmed before the hash is calculated, so identical code is not counted as separate Workers. Other differences, such as whitespace, can change behavior and are not normalized.
2. **Overload Prevention via Rate Limiting**: Calls to the execution endpoint are limited per client IP (container and Durable Object runs get a tighter limit) to prevent overload attacks by automated scripts. The limits are approximate and counted separately in each Cloudflare location.
3. **Cost Control**: Dynamic Workers are billed for the number of unique Workers created per day (a Worker is identified by its ID and code), plus requests and CPU time (including startup time). A paid plan is required. Everyone who runs the unedited lesson code uses the same Worker, so the unique count does not grow. Edited code becomes a new Worker whenever its content changes, so the per-IP rate limit is what bounds it.
