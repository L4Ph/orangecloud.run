# Workers 的执行模型

Worker 就是**每个请求调用一次的函数**。`fetch(request, env)` 的返回值就是响应。

## 需要记住的四点

1. **状态不保证跨请求保留。** 全局变量只在 isolate 被复用时存在。要留住的就放进 KV / D1 / R2 / Durable Objects。
2. **没有文件，没有 socket。** 访问外部世界靠 `fetch()` 和绑定（`env.DB` 等）。
3. **按 CPU 时间计费。** 等网络或 `sleep` 不收费，所以“等外部 API”很便宜。
4. **限制先到。** 内存 128MB，CPU 默认 30 秒（付费最多 5 分钟），并发数取决于套餐。死循环会杀死你自己的 Worker。

## 大致限制

| 项目     | 免费      | 付费                      |
| -------- | --------- | ------------------------- |
| 请求数   | 10 万/天  | 1000 万/月 + 用量         |
| CPU 时间 | 10ms/请求 | 30 秒/请求（最多 5 分钟） |
| 内存     | 128MB     | 128MB                     |

先把它想成“每次请求都是一间干净的房间”就够用了。想保留状态时，进入下一章。

```js
export default {
  async fetch(request, env, ctx) {
    // request / env（绑定）/ ctx（waitUntil 等）
    return new Response('hello');
  },
};
```
