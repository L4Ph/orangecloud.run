# Hono

Frameworks like Express, which supported the early days of Node.js, were heavily dependent on OS `net.Socket` and Node-specific `http.IncomingMessage`. Consequently, they cannot be brought as-is into web-standards-compliant edge environments like Cloudflare Workers, which lack this legacy.

Hono is a **web framework designed exclusively around `Request` and `Response` objects**—features built into browsers and edge runtimes. Whether using Node.js, Bun, Deno, or Cloudflare Workers, the same codebase runs with a tiny footprint and no dependencies.

## Minimal Configuration

```ts
import { Hono } from 'hono';

const app = new Hono();

// Route definition
app.get('/', (c) => c.text('hello from hono'));

// Can be exposed as-is as a Cloudflare Workers entry point
export default app;
```

## Path Routing and Parameter Extraction

```ts
app.get('/users/:id', (c) => c.json({ userId: c.req.param('id') }));
app.get('/static/*', (c) => c.text(c.req.path));
app.post('/items', (c) => c.text('created', 201));

// Module binding for sub-routers
app.route('/api/v1', apiRoutes);
```

- Supports path parameter extraction via `:param` and wildcard catching with `*`.
- When static paths, parameterized paths, and wildcards are mixed, the most specific path takes precedence regardless of definition order.

## Input/Output Operations via Context

Type-safe request parsing and response generation are handled through the `c` argument (Context).

```ts
// Extract request information
const authHeader = c.req.header('authorization');
const queryPage = c.req.query('page');
const bodyJson = await c.req.json();

// Send response
return c.json({ status: 'ok', data: bodyJson }, 201);
```

Since it merely thinly wraps native `Request` / `Response` internally, it is also possible to extract raw web-standard objects directly from `c.req.raw`.

## Middleware Pipeline Integration

```ts
// Global execution timing middleware
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header('server-timing', `total;dur=${duration.toFixed(2)}`);
});

// Authentication check and early exit
app.use('/admin/*', async (c, next) => {
  if (!c.req.header('authorization')) {
    return c.text('unauthorized', 401);
  }
  await next();
});
```

By inserting `await next()`, preprocessing on request reception and postprocessing on response return can be naturally expressed within a single function. Early return when conditions are not met acts as a safety valve, terminating the process without triggering downstream handlers.

## Type-Safe RPC (Remote Procedure Call)

One of Hono's greatest strengths is its ability to automatically derive the client-side RPC client type from the server-side route definition.

```ts
// Server side (exposing route type definition)
const api = new Hono().get('/posts/:id', (c) => c.json({ id: c.req.param('id'), title: 'Demo' }));
export type AppType = typeof api;

// Client side (calling via autocomplete without writing any URL string)
import { hc } from 'hono/client';
const client = hc<AppType>('https://example.com');
const response = await client.posts[':id'].$get({ param: { id: '42' } });
const data = await response.json(); // Inferred as { id: string, title: string }
```
