# Hono

Hono 是一个只依赖标准 `Request` / `Response` 的小型 Web 框架。同一份代码能在 Node.js、Bun、Deno 和 Cloudflare Workers 上运行，依赖少所以启动也快。先把它当作“路由和中间件的工具箱”来记就好。

## 最小的应用

```ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('hello'));

export default app; // Workers / Bun 直接可用
```

Node.js 上用 `@hono/node-server` 的 `serve({ fetch: app.fetch })` 启动。

## 路由

```ts
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
app.get('/files/*', (c) => c.text(c.req.path));
app.post('/users', (c) => c.text('created', 201));
app.route('/admin', adminRoutes); // 挂载另一个路由器
```

- `:id` 是参数，`*` 是通配
- `app.route()` 可以把路由器拆到别的文件（如 `routes/users.ts`）
- 匹配不是按注册顺序，而是静态 > 参数 > 通配

## 请求

```ts
c.req.param('id');
c.req.query('page');
c.req.header('authorization');
await c.req.json();
await c.req.formData();
```

`c.req.raw` 拿到原始 `Request`。

## 响应

```ts
c.text('ok');
c.json({ ok: true }, 201);
c.html('<h1>hi</h1>');
c.redirect('/login');
c.body(stream);
```

状态码是第二个参数，响应头用 `c.header('x-foo', 'bar')`。需要完全控制时用 `c.newResponse()`。

## 中间件

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

- `await next()` 之前是前置处理，之后是后置处理
- 用 `c.set('user', user)` / `c.get('user')` 往下游传值
- 内置了 `logger()`、`cors()`、`basicAuth()` 等常用中间件

## 输入校验

```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

app.post('/users', zValidator('json', z.object({ name: z.string().min(1) })), (c) => {
  const { name } = c.req.valid('json');
  return c.json({ name }, 201);
});
```

校验后的值会带着类型进入处理函数。

## 错误处理

```ts
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});

app.notFound((c) => c.json({ error: 'not found' }, 404));
```

抛出 `HTTPException` 也能被 `onError` 捕获。

## 类型化 RPC

```ts
// 服务端
const api = new Hono().get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
export type AppType = typeof api;

// 客户端
import { hc } from 'hono/client';
const client = hc<AppType>('/');
const res = await client.users[':id'].$get({ param: { id: '1' } });
```

客户端不用手写路径字符串。

## 本地运行

```sh
npm create hono@latest
npm run dev
```

想了解路由器的内部和 RPC 的类型机制，看 [Hono 的路由器与中间件](/docs/hono)。

## 为什么这个编辑器里不运行

这里的沙箱只接受纯 JavaScript 模块。要解析 `import 'hono'` 必须先打包，所以本章仅作资料。
