# Hono 的内部设计（路由器与中间件合成）

在表面上的路由语法之下，Hono 采用了高级优化技术，以应对边缘环境严苛的资源限制。本文将揭示路由器引擎的切换机制，以及将多层中间件扁平化为单一异步函数的合成结构。

## 优化路由器的自动选择

Hono 拥有一个名为 `SmartRouter` 的统一层，能根据注册路由的特性自动选择最合适的路由引擎。

- **RegExpRouter**：将所有注册路径编译成一个大的正则表达式，只需一次匹配即可确定目标处理器。Hono 的官方文档称其为 JavaScript 中最快的路由器。但它并不支持所有路由模式，因此通常与其他路由器组合使用。
- **TrieRouter**：按 `/` 分隔的每个段在字典树（Trie）中逐段查找。它支持所有模式，因此在存在 RegExpRouter 无法处理的路由时充当回退方案。

匹配的优先级就是注册顺序。匹配到的处理器和中间件按注册顺序执行，在返回 `Response` 的地方停止。因此，如果先注册了 `/users/:id`，对 `/users/me` 的请求也会由它处理，所以要先注册特殊路径。SmartRouter 决定的只是用哪个路由器进行匹配：在第一次匹配时，它会选定第一个能够注册全部路由的路由器（RegExpRouter，无法注册则用 TrieRouter）。

## 中间件合成机制

中间件链的实质是函数式编程中的函数合成（Composition）。注册的多阶段处理器群在请求处理开始时，通过 `compose()` 处理，被折叠为一条嵌套的异步回调。

```ts
const timing = async (c, next) => {
  const start = performance.now(); // 在 Workers 中只会在 I/O 之后才前进
  await next(); // 将处理权限移交给下一段中间件或最终处理器
  const elapsed = performance.now() - start;
  c.header("server-timing", `work;dur=${elapsed}`);
};
```

- 即使下游的处理器或中间件抛出异常，Hono 也会捕获并交给 `app.onError()`（没有的话转成 500）。因此 `await next()` 不会抛出异常，不需要用 `try / finally` 包裹。被捕获的异常可通过 `c.error` 读取。
- 通过使用 `c.set(key, value)` 和 `c.get(key)`，可以将认证中间件解密后的用户信息等安全地传递给后续处理器。此类上下文变量可以使用 TypeScript 的泛型来应用严格的类型。

## 流式传输的控制

像大语言模型的逐步输出那样，需要边生成边发送时，使用 `hono/streaming` 中的流式辅助函数（Streaming Helper）。

```ts
import { streamSSE, streamText } from "hono/streaming";

// 文本块的流式传输
return streamText(c, async (stream) => {
  for (const token of textTokens) {
    await stream.write(token);
    await stream.sleep(20);
  }
});

// Server-Sent Events（SSE）的发送
return streamSSE(c, async (stream) => {
  await stream.writeSSE({ data: JSON.stringify({ event: "ping" }) });
});
```

在流内部通过 `stream.onAbort()` 注册回调，客户端关闭浏览器标签页等导致连接断开时，就可以执行停止上游 API 调用或计算的处理。
