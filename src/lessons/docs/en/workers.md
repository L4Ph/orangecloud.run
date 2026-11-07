# The Worker Execution Model

If you start writing Workers with a traditional server development mindset, the first thing that will trip you up is the lifespan of global variables. Where is the memory that can be shared across requests? The answer is: nowhere.

At its core, a Worker is a **function called every time an event arrives**. For an HTTP request, `fetch(request, env, ctx)` processes the received request, and the returned `Response` object is sent directly to clients worldwide.

## Four Dominant Constraints

1. **State does not persist across requests.** Values written to global variables survive only as long as the same isolate happens to be reused. If the next request flies to a data center on a different continent, what awaits it is fresh memory. Any data you want to persist must always be moved to KV, D1, R2, or Durable Objects.
2. **No persistent disk, no listening sockets.** What `node:fs` gives you is a virtual file system in memory, and only `/tmp` is writable. Its contents are separate for each request and do not remain afterward. You cannot open a Raw socket to listen either. External communication channels are limited to `fetch()`, `connect()` for outbound TCP connections, and the bindings injected by the platform (such as `env.DB`).
3. **Billing is based on the number of requests and CPU time.** Time spent waiting for responses from external APIs or stopped by a timer does not count as CPU time. Elapsed time itself is not billed either.
4. **Resources have limits.** The memory limit is 128MB per isolate. CPU execution time is capped at 10ms per request in the free tier, and even in the paid tier, it is limited to 30 seconds (up to 5 minutes) by default. An execution that keeps hitting a limit is terminated, and the client receives Error 1102 (`Worker exceeded resource limits`).

## Comparison of Limits

| Item     | Free Plan    | Paid Plan                                         |
| -------- | ------------ | ------------------------------------------------- |
| Requests | 100k/day     | No limit (10M/month included, usage-based beyond) |
| CPU Time | 10ms/request | 30 seconds/request (max 5 min)                    |
| Memory   | 128MB        | 128MB                                             |

"A clean, disposable room provided for every request." With this mental model, you avoid the mistake of keeping state in global variables.

```js
export default {
  async fetch(request, env, ctx) {
    // request: received HTTP request
    // env: bindings (KV, D1, secrets, etc.)
    // ctx: lifecycle control such as waitUntil
    return new Response("hello from workers");
  },
};
```
