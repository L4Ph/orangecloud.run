# Hono

支撑 Node.js 黎明期的 Express 等框架，深度依赖 Node.js 的 `net.Socket` 和 `http.IncomingMessage`。Workers 传递给代码的是 Web 标准的 `Request` / `Response`。Express 也可以运行，需要使用 Node.js 兼容 API（`nodejs_compat`，compatibility date 为 2026-08-04 或之后时默认启用）和 `cloudflare:node` 的 `httpServerHandler`（官方提供了教程），但这以 Node.js 兼容层为前提。

Hono 是一个**仅以浏览器和边缘运行时标配的 `Request` 和 `Response` 对象为前提而设计的 Web 框架**。同一套代码可以在 Cloudflare Workers、Deno、Bun 等环境中运行。Hono 起初并不是为 Node.js 设计的，但借助 Node.js 适配器（`@hono/node-server`），它也可以在 Node.js 上运行。Hono 本身没有依赖，`hono/tiny` 预设小于 12kB。

## 最小化配置

```ts
import { Hono } from "hono";

const app = new Hono();

// 路由定义
app.get("/", (c) => c.text("hello from hono"));

// 可直接作为 Cloudflare Workers 的入口点公开
export default app;
```

## 路径路由与参数提取

```ts
app.get("/users/:id", (c) => c.json({ userId: c.req.param("id") }));
app.get("/static/*", (c) => c.text(c.req.path));
app.post("/items", (c) => c.text("created", 201));

// 子路由器的模块组合
app.route("/api/v1", apiRoutes);
```

- 支持 `:param` 形式的路径参数提取以及 `*` 的通配符捕获。
- 匹配同一路径的处理器和中间件按注册顺序执行。处理到返回 `Response` 的处理器时即停止，因此 `/users/me` 这样的特殊路径应写在 `/users/:id` 之前，作为兜底的 `*` 写在最后。

## 通过上下文进行输入输出操作

通过参数 `c`（Context）读取请求并生成响应。只有经过 `hono/validator` 等验证器的输入才有类型，`c.req.json()` 在 Hono v4 中返回 `any`。

```ts
// 提取请求信息
const authHeader = c.req.header("authorization");
const queryPage = c.req.query("page");
const bodyJson = await c.req.json();

// 发送响应
return c.json({ status: "ok", data: bodyJson }, 201);
```

由于内部仅是对原生的 `Request` / `Response` 进行薄层包装，因此也可以直接从 `c.req.raw` 中提取原始的 Web 标准对象。

## 中间件流水线的组合

```ts
// 全局执行时间计时中间件。部署到 Workers 后，performance.now() 只会在发生 I/O 之后才前进
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header("server-timing", `total;dur=${duration.toFixed(2)}`);
});

// 提前退出的示例（只检查请求头是否存在；认证请使用 hono/bearer-auth 等）
app.use("/admin/*", async (c, next) => {
  if (!c.req.header("authorization")) {
    return c.text("unauthorized", 401);
  }
  await next();
});
```

通过插入 `await next()`，可以在单个函数内自然地实现请求接收时的预处理和响应返回时的后处理。在不符合条件时进行提前返回，可作为安全阀，在不触发下游处理程序的情况下终止处理。

## 类型安全的 RPC（Remote Procedure Call）

在 Hono 中，可以从服务器端的路由定义自动推导出客户端 RPC 客户端的类型。

```ts
// 服务器端（公开路由的类型定义）
const api = new Hono().get("/posts/:id", (c) => c.json({ id: c.req.param("id"), title: "Demo" }));
export type AppType = typeof api;

// 客户端（除基础 URL 外无需编写任何 URL 字符串，借助类型补全进行调用）
import { hc } from "hono/client";
const client = hc<AppType>("https://example.com");
const response = await client.posts[":id"].$get({ param: { id: "42" } });
const data = await response.json(); // 推导为 { id: string, title: string }
```
