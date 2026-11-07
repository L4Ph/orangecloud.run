# Hono's Internal Design (Router and Middleware Composition)

Beneath the surface-level routing syntax, Hono employs advanced optimizations to withstand the severe resource constraints of edge environments. This section unravels the router engine switching mechanism and the composition structure that flattens multi-layered middleware into a single asynchronous function.

## Automatic Selection of Optimized Routers

Hono features a governing layer called `SmartRouter`, which automatically selects the optimal routing engine based on the characteristics of the registered routes.

- **RegExpRouter**: Compiles all registered paths into a single, lengthy regular expression to identify the target handler in a single regular expression match. It completes branching with overwhelming speed—nearly constant time—even for dozens or hundreds of routes.
- **TrieRouter**: Searches URL segments character-by-character using a tries tree structure. It serves as a stable fallback for routes with complex wildcard and regular expression captures.

Matching priority is not determined by the registration order of the array. Exact-match static segments are evaluated most strongly, followed by path parameters, and wildcards (`*`) as the lowest priority. Consequently, by design, errors such as the special endpoint `/users/me` being mistakenly swallowed by the previously registered `/users/:id` do not occur.

## Middleware Composition Mechanism

The core of the middleware chain is function composition in functional programming. The registered multi-stage handler group undergoes a `compose()` operation at the start of request processing, collapsing into a single nested asynchronous callback.

```ts
const timing = async (c, next) => {
  const start = performance.now();
  try {
    await next(); // Pass processing to the next middleware or final handler
  } finally {
    const elapsed = performance.now() - start;
    c.header("server-timing", `work;dur=${elapsed}`);
  }
};
```

- A robust pattern is to wrap `await next()` in the `try / finally` syntax to ensure cleanup is performed even if an exception occurs in the post-processing.
- By using `c.set(key, value)` and `c.get(key)`, user information decrypted by authentication middleware can be safely passed to subsequent handlers. Strict types can be applied to these context variables using TypeScript generics.

## Control of Streaming Transmission

For sequential output of large language models or real-time transfer of large files, streaming helpers are used instead of standard response buffering.

```ts
// Streaming text chunks
return c.streamText(async (stream) => {
  for (const token of textTokens) {
    await stream.write(token);
    await stream.sleep(20);
  }
});

// Sending Server-Sent Events (SSE)
return c.streamSSE(async (stream) => {
  await stream.writeSSE({ data: JSON.stringify({ event: "ping" }) });
});
```

By registering an `stream.onAbort()` listener within the stream, the system can detect the moment the client disconnects communication—such as by closing a browser tab—and immediately interrupt unnecessary upstream API usage or computational resource waste.
