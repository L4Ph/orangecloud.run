# Hono's Internal Design (Router and Middleware Composition)

Beneath the surface-level routing syntax, Hono employs advanced optimizations to withstand the severe resource constraints of edge environments. This section unravels the router engine switching mechanism and the composition structure that flattens multi-layered middleware into a single asynchronous function.

## Automatic Selection of Optimized Routers

Hono features a governing layer called `SmartRouter`, which automatically selects the optimal routing engine based on the characteristics of the registered routes.

- **RegExpRouter**: Compiles all registered paths into one large regular expression and identifies the target handler with a single match. Hono's documentation calls it the fastest router in the JavaScript world. However, it does not support every routing pattern, so it is normally combined with another router.
- **TrieRouter**: Walks a trie one `/`-separated segment at a time. It supports every pattern, so it serves as the fallback when there are routes that RegExpRouter cannot handle.

Matching priority is registration order. Matching handlers and middleware run in the order they were registered, and processing stops at the first one that returns a `Response`. Therefore, if `/users/:id` is registered first, a request to `/users/me` is also handled by it, so register special paths first. SmartRouter only decides which router does the matching. At the first match, it settles on the first router that can register all routes: RegExpRouter, or TrieRouter if RegExpRouter cannot.

## Middleware Composition Mechanism

The core of the middleware chain is function composition in functional programming. The registered multi-stage handler group undergoes a `compose()` operation at the start of request processing, collapsing into a single nested asynchronous callback.

```ts
const timing = async (c, next) => {
  const start = performance.now(); // On Workers, only advances after I/O
  await next(); // Pass processing to the next middleware or final handler
  const elapsed = performance.now() - start;
  c.header("server-timing", `work;dur=${elapsed}`);
};
```

- Even if a downstream handler or middleware throws, Hono catches the exception and passes it to `app.onError()` (or turns it into a 500 if there is none). `await next()` therefore never throws, and there is no need to wrap it in `try / finally`. The caught exception can be read from `c.error`.
- By using `c.set(key, value)` and `c.get(key)`, user information decrypted by authentication middleware can be safely passed to subsequent handlers. Strict types can be applied to these context variables using TypeScript generics.

## Control of Streaming Transmission

To send output as soon as each part is ready, as with the sequential output of a large language model, use the streaming helpers from `hono/streaming`.

```ts
import { streamSSE, streamText } from "hono/streaming";

// Streaming text chunks
return streamText(c, async (stream) => {
  for (const token of textTokens) {
    await stream.write(token);
    await stream.sleep(20);
  }
});

// Sending Server-Sent Events (SSE)
return streamSSE(c, async (stream) => {
  await stream.writeSSE({ data: JSON.stringify({ event: "ping" }) });
});
```

If you register a callback with `stream.onAbort()` inside the stream, you can run code that stops upstream API calls or computation when the client disconnects, for example by closing the browser tab.
