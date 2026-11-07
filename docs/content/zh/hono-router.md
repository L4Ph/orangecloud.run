# Hono 的路由器与中间件

基础之后再看：路由器如何选择、中间件如何组合、类型如何一路传到客户端。

## 路由器可以替换

`SmartRouter` 会自动选择实现。默认把把路由编译成一条正则的 `RegExpRouter` 与 `TrieRouter` 组合起来，路由表很大也不易退化。也可以显式指定：`new Hono({ router: new TrieRouter() })`。

匹配不是按注册顺序，而是静态段 > 参数 > 通配。`/users/me` 不会被 `/users/:id` 吞掉。

## 中间件就是函数组合

`await next()` 只是“调用剩下的链条”。Hono 会用 `compose()` 把注册的中间件折成一个函数再执行。

```ts
const timing = async (c, next) => {
  const start = performance.now();
  await next();
  c.header('server-timing', `app;dur=${performance.now() - start}`);
};
```

- 后处理写在 `next()` 之后；必须执行就用 `try/finally`
- 提前 return 会跳过后续（认证的常见写法）
- `c.set` / `c.get` 是请求作用域；用 `new Hono<{ Variables: { user: User } }>()` 加类型
- 中间件也能按路由挂：`app.get('/x', mw1, mw2, handler)`

## 类型如何到达端点

Hono 把路由定义的类型直接交给客户端。`hc<typeof app>()` 从 `AppType` 推导 URL 与输入输出类型，不需要再写一遍路径或 body 形状。

```ts
const api = new Hono().post('/posts', zValidator('json', schema), (c) => c.json({ id: 1 }, 201));

export type AppType = typeof api;
```

```ts
const client = hc<AppType>('https://api.example.com');
await client.posts.$post({ json: { title: 'hello' } });
```

用 `app.route('/v1', api)` 挂载也能保留类型。`InferRequestType` / `InferResponseType` 可以单独取出。

## 流式响应

```ts
return c.streamText(async (stream) => {
  for (const token of tokens) await stream.write(token);
});

return c.streamSSE(async (stream) => {
  await stream.writeSSE({ data: 'hello' });
});
```

适合 LLM 的长回答或日志流。`stream.onAbort()` 能捕获断开。

## 测试

`app.request()` 不需要启动服务器就能发请求，Workers 和 Node 上写法一致。

```ts
const res = await app.request('/users/1');
expect(res.status).toBe(200);
```

## 性能要点

- 不要把所有中间件都挂在全局，按路由范围挂
- `c.req.json()` 只读一次，第二次读到的是空流
- 大响应用 `c.body(stream)` 流式返回，不要先缓冲
- 路由超过几百条时注意 `RegExpRouter` 的注册上限，考虑拆分

## 参考

- `hono.dev` 文档（Router、Middleware、RPC、Testing）
- `@hono/zod-validator` 同时获得校验和类型推断
