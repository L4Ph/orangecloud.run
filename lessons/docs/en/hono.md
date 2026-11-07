# Hono

Hono is a small web framework built on nothing but the standard `Request` / `Response`. The same code runs on Node.js, Bun, Deno, and Cloudflare Workers, and with few dependencies it starts fast. Treat it as a toolkit for routing and middleware and the rest follows.

## The smallest app

```ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('hello'));

export default app; // Works on Workers and Bun
```

On Node.js, start it with `serve({ fetch: app.fetch })` from `@hono/node-server`.

## Routing

```ts
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
app.get('/files/*', (c) => c.text(c.req.path));
app.post('/users', (c) => c.text('created', 201));
app.route('/admin', adminRoutes); // mount another router
```

- `:id` is a parameter, `*` is a wildcard
- `app.route()` lets you keep routers in separate files (`routes/users.ts`)
- Matching is not registration order: static beats parameter beats wildcard

## Requests

```ts
c.req.param('id');
c.req.query('page');
c.req.header('authorization');
await c.req.json();
await c.req.formData();
```

`c.req.raw` is the underlying `Request`.

## Responses

```ts
c.text('ok');
c.json({ ok: true }, 201);
c.html('<h1>hi</h1>');
c.redirect('/login');
c.body(stream);
```

Status is the second argument; set headers with `c.header('x-foo', 'bar')`. `c.newResponse()` is there when you need full control.

## Middleware

```ts
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  c.header('server-timing', `app;dur=${performance.now() - start}`);
});

app.use('/admin/*', async (c, next) => {
  if (!c.req.header('authorization')) return c.text('forbidden', 403);
  await next();
});
```

- Before `await next()` is pre-processing, after is post-processing
- Share values downstream with `c.set('user', user)` / `c.get('user')`
- Built-ins cover the common cases: `logger()`, `cors()`, `basicAuth()`, and more

## Validating input

```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

app.post('/users', zValidator('json', z.object({ name: z.string().min(1) })), (c) => {
  const { name } = c.req.valid('json');
  return c.json({ name }, 201);
});
```

The validated value arrives with its type.

## Errors

```ts
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});

app.notFound((c) => c.json({ error: 'not found' }, 404));
```

Throw an `HTTPException` and `onError` can pick it up.

## Typed RPC

```ts
// server
const api = new Hono().get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
export type AppType = typeof api;

// client
import { hc } from 'hono/client';
const client = hc<AppType>('/');
const res = await client.users[':id'].$get({ param: { id: '1' } });
```

No hand-written paths on the client.

## Running it locally

```sh
npm create hono@latest
npm run dev
```

For the router internals and how RPC is typed, see [Hono's router and middleware](/docs/hono).

## Why it does not run in this editor

The sandbox only accepts plain JavaScript modules. Resolving `import 'hono'` requires bundling first, so this chapter is reference only.
