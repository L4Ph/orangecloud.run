# Hono

支撑 Node.js 黎明期的 Express 等框架，深切依赖于操作系统的 `net.Socket` 以及 Node 特有的 `http.IncomingMessage`。因此，这些框架无法直接引入到像 Cloudflare Workers 这样不具备相关遗产的 Web 标准符合的边缘环境中。

Hono 是一个**仅以浏览器和边缘运行时标配的 `Request` 和 `Response` 对象为前提而设计的 Web 框架**。无论是 Node.js、Bun、Deno 还是 Cloudflare Workers，同一套代码库即可在无需依赖的情况下以极小的占用规模运行。

## 最小化配置

```ts
import { Hono } from 'hono';

const app = new Hono();

// 路由定义
app.get('/', (c) => c.text('hello from hono'));

// 可直接作为 Cloudflare Workers 的入口点公开
export default app;
```

## 路径路由与参数提取

```ts
app.get('/users/:id', (c) => c.json({ userId: c.req.param('id') }));
app.get('/static/*', (c) => c.text(c.req.path));
app.post('/items', (c) => c.text('created', 201));

// 子路由器的模块组合
app.route('/api/v1', apiRoutes);
```

- 支持 `:param` 形式的路径参数提取以及 `*` 的通配符捕获。
- 当静态路径、带参数的路径和通配符混用时，无论定义顺序如何，最具体的路径将优先匹配。

## 通过上下文进行输入输出操作

通过参数 `c`（Context）实现类型安全的请求解析与响应生成。

```ts
// 提取请求信息
const authHeader = c.req.header('authorization');
const queryPage = c.req.query('page');
const bodyJson = await c.req.json();

// 发送响应
return c.json({ status: 'ok', data: bodyJson }, 201);
```

由于内部仅是对原生的 `Request` / `Response` 进行薄层包装，因此也可以直接从 `c.req.raw` 中提取原始的 Web 标准对象。

## 中间件流水线的组合

```ts
// 全局执行时间计时中间件
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header('server-timing', `total;dur=${duration.toFixed(2)}`);
});

// 认证检查与提前退出
app.use('/admin/*', async (c, next) => {
  if (!c.req.header('authorization')) {
    return c.text('unauthorized', 401);
  }
  await next();
});
```

通过插入 `await next()`，可以在单个函数内自然地实现请求接收时的预处理和响应返回时的后处理。在不符合条件时进行提前返回，可作为安全阀，在不触发下游处理程序的情况下终止处理。

## 类型安全的 RPC（Remote Procedure Call）

Hono 最大的优势之一在于，能够从服务器端的路由定义自动推导出客户端 RPC 客户端的类型。

```ts
// 服务器端（公开路由的类型定义）
const api = new Hono().get('/posts/:id', (c) => c.json({ id: c.req.param('id'), title: 'Demo' }));
export type AppType = typeof api;

// 客户端（无需编写任何 URL 字符串，通过全自动补全调用）
import { hc } from 'hono/client';
const client = hc<AppType>('https://example.com');
const response = await client.posts[':id'].$get({ param: { id: '42' } });
const data = await response.json(); // 推导为 { id: string, title: string }
```
