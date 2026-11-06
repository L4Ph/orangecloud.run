# Durable Objects（DO）

**每个名字在全世界只有一个实例**的对象。内部带有 SQLite 存储和串行化的方法调用。“不可能同时存在两个”就是它的保证，所以计数器、库存、聊天室、限流器和协调者都用它来做。

## 为什么需要它

Workers 每个请求都可能落在不同的 isolate 上，全局变量不可信。DO 就是**用名字调用唯一实例**，例如 `Counter.get('global')`。调用会在该实例中逐个按顺序处理。

## 要记住的

- 给 `env.COUNTER` 一个名字，就得到该实例的 stub
- stub 上的方法是 RPC，返回值必须可序列化
- 存储是 SQLite（`ctx.storage.get/put`，也可以写 SQL）
- `ctx.storage.setAlarm()` 可以“稍后唤醒我”（提醒、批处理）
- 空闲时不收费（hibernation）

这里的 `env.COUNTER` 是真正部署的 Durable Object。**值会跨执行保留。** 多执行几次，看它增长。

```js
const n = await env.COUNTER.increment(); // 同名即同实例
await env.COUNTER.read();                // 读取已保存的值
```
