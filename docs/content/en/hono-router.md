# Hono's router and middleware

For after the basics: how the router is chosen, how middleware composes, and how types reach the client.

## Routers are swappable

`SmartRouter` picks an implementation for you. By default it combines `RegExpRouter`, which compiles routes into a single regular expression, with `TrieRouter` so large route tables stay stable. You can also pass one explicitly: `new Hono({ router: new TrieRouter() })`.

Matching is not registration order: static segments beat parameters beat wildcards. `/users/me` will not be swallowed by `/users/:id`.

## Middleware is function composition

`await next()` simply calls the rest of the chain. Hono composes registered middleware into one function with `compose()` before running it.

```ts
const timing = async (c, next) => {
  const start = performance.now();
  await next();
  c.header('server-timing', `app;dur=${performance.now() - start}`);
};
```

- Post-processing goes after `next()`; wrap in `try/finally` if it must always run
- Returning early skips the rest of the chain (the usual auth pattern)
- `c.set` / `c.get` are request-scoped; type them with `new Hono<{ Variables: { user: User } }>()`
- Middleware can also be per-route: `app.get('/x', mw1, mw2, handler)`

## How types reach the endpoint

Hono hands the route type itself to the client. `hc<typeof app>()` builds URLs and input/output types from `AppType`, so you never restate a path or a body shape.

```ts
const api = new Hono().post('/posts', zValidator('json', schema), (c) => c.json({ id: 1 }, 201));

export type AppType = typeof api;
```

```ts
const client = hc<AppType>('https://api.example.com');
await client.posts.$post({ json: { title: 'hello' } });
```

Mounting with `app.route('/v1', api)` keeps the types too. `InferRequestType` / `InferResponseType` pull out individual pieces.

## Streaming

```ts
return c.streamText(async (stream) => {
  for (const token of tokens) await stream.write(token);
});

return c.streamSSE(async (stream) => {
  await stream.writeSSE({ data: 'hello' });
});
```

Use this for long LLM responses or log tails. `stream.onAbort()` catches disconnects.

## Testing

`app.request()` sends a request without starting a server, so the same test works on Workers and Node.

```ts
const res = await app.request('/users/1');
expect(res.status).toBe(200);
```

## Performance notes

- Do not add global middleware for everything; scope it per route
- Read `c.req.json()` once. The body stream is empty the second time
- Stream large responses with `c.body(stream)` instead of buffering
- Past a few hundred routes, watch `RegExpRouter` registration limits and split routers

## References

- `hono.dev` docs (Router, Middleware, RPC, Testing)
- `@hono/zod-validator` for validation plus inference
