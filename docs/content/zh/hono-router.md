# Hono 的内部设计（路由器与中间件合成）

在表面上的路由语法之下，Hono 采用了高级优化技术，以应对边缘环境严苛的资源限制。本文将揭示路由器引擎的切换机制，以及将多层中间件扁平化为单一异步函数的合成结构。

## 优化路由器的自动选择

Hono 拥有一个名为 `SmartRouter` 的统一层，能根据注册路由的特性自动选择最合适的路由引擎。

- **RegExpRouter**：将所有注册路径编译为单一的长正则表达式，通过一次正则表达式匹配即可确定目标处理器。即使面对数十至数百条路由，也能以接近常数时间的极快速度完成分支。
- **TrieRouter**：利用树形结构（Trie）逐字符搜索 URL 段。在包含复杂的通配符和正则表达式捕获的路由群中，它能作为稳定的回退方案。

匹配的优先级并非基于数组的注册顺序。完全匹配的静态段优先级最高，其次是路径参数，最后是优先级最低的通配符（`*`）。因此，从结构上讲，不会出现 `/users/me` 这样的特殊端点被误导至先注册的 `/users/:id` 的情况。

## 中间件合成机制

中间件链的实质是函数式编程中的函数合成（Composition）。注册的多阶段处理器群在请求处理开始时，通过 `compose()` 处理，被折叠为一条嵌套的异步回调。

```ts
const timing = async (c, next) => {
  const start = performance.now();
  try {
    await next(); // 将处理权限移交给下一段中间件或最终处理器
  } finally {
    const elapsed = performance.now() - start;
    c.header('server-timing', `work;dur=${elapsed}`);
  }
};
```

- 为了确保在后处理中发生异常时也能可靠地进行清理，使用 `try / finally` 语法将 `await next()` 包裹起来是一个稳健的模式。
- 通过使用 `c.set(key, value)` 和 `c.get(key)`，可以将认证中间件解密后的用户信息等安全地传递给后续处理器。此类上下文变量可以使用 TypeScript 的泛型来应用严格的类型。

## 流式传输的控制

对于大规模语言模型的序列输出或大容量文件的实时传输，采用流式辅助函数（Streaming Helper）而非标准的响应缓冲。

```ts
// 文本块的流式传输
return c.streamText(async (stream) => {
  for (const token of textTokens) {
    await stream.write(token);
    await stream.sleep(20);
  }
});

// Server-Sent Events（SSE）的发送
return c.streamSSE(async (stream) => {
  await stream.writeSSE({ data: JSON.stringify({ event: 'ping' }) });
});
```

在流内部注册 `stream.onAbort()` 监听器，即可在客户端关闭浏览器标签页等导致通信中断的瞬间进行检测，从而立即中断不必要的上游 API 消耗或计算资源的浪费。
