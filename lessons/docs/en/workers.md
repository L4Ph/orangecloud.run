# The Workers execution model

A Worker is **a function called once per request**. Whatever `fetch(request, env)` returns becomes the response.

## Four things to hold onto

1. **State is not guaranteed across requests.** Globals survive only while the isolate is reused. Anything you want to keep goes to KV / D1 / R2 / Durable Objects.
2. **No files, no sockets.** You reach the outside world with `fetch()` and bindings (`env.DB` and friends).
3. **You pay for CPU time.** Waiting on the network or `sleep` is free, which makes "wait for an external API" cheap.
4. **Limits come first.** 128MB of memory, 30s of CPU by default (up to 5 minutes on paid), and a concurrency cap by plan. An infinite loop kills your own Worker.

## Rough limits

| | Free | Paid |
| --- | --- | --- |
| Requests | 100k/day | 10M/month + usage |
| CPU time | 10ms/request | 30s/request (max 5 min) |
| Memory | 128MB | 128MB |

"Every request gets a clean room" is a good enough mental model to start. When you want state, go to the next chapter.

```js
export default {
  async fetch(request, env, ctx) {
    // request / env (bindings) / ctx (waitUntil, …)
    return new Response('hello');
  },
};
```
