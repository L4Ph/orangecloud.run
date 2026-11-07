# The Worker Execution Model

If you start writing Workers with a traditional server development mindset, the first thing that will trip you up is the lifespan of global variables. Where is the memory that can be shared across requests? The answer is: nowhere.

At its core, a Worker is nothing more than a **pure function called every time an HTTP request arrives**. `fetch(request, env, ctx)` processes the received request, and the returned `Response` object is sent directly to clients worldwide.

## Four Dominant Constraints

1. **State does not persist across requests.** Values written to global variables survive only as long as the same isolate happens to be reused. If the next request flies to a data center on a different continent, what awaits it is fresh memory. Any data you want to persist must always be moved to KV, D1, R2, or Durable Objects.
2. **No filesystem, no resident sockets.** You can neither spit out temporary files to disk nor open a Raw socket to listen. External communication channels are limited to `fetch()` and the bindings injected by the platform (such as `env.DB`).
3. **Billing is calculated by CPU time.** Time spent waiting for responses from external APIs or time spent stopped by a timer is not billed. This is why Workers can be operated at an extremely low cost as a centralized proxy for microservices.
4. **Hardware limits are the first to bite.** The memory limit is 128MB. CPU execution time is capped at 10ms per request in the free tier, and even in the paid tier, it is limited to 30 seconds (up to 5 minutes) by default. If you run an infinite loop, the system will ruthlessly force-terminate that isolate.

## Comparison of Limits

| Item     | Free Plan    | Paid Plan                      |
| -------- | ------------ | ------------------------------ |
| Requests | 100k/day     | 10M/month + usage-based        |
| CPU Time | 10ms/request | 30 seconds/request (max 5 min) |
| Memory   | 128MB        | 128MB                          |

"A clean, disposable room provided for every request." Once this mental model takes hold, you will no longer fall into the serverless trap.

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
