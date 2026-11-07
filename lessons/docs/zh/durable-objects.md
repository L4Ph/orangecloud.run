# Durable Objects（分布式状态管理）

Workers 最大的优势在于，正因为不持有状态（stateless），能够在全球各端点瞬间扩展。然而，实际应用程序需要“全球唯一且绝对不能产生矛盾的状态”，例如协作编辑的光标同步、聊天室的参与者管理、限额票券的库存分配等。

如果依赖全局变量，不同 isolate 之间的值会产生偏差；而在普通数据库中，则会为并发写入的锁竞争而苦恼。为了解决这一困境，设计了 **Durable Objects（DO）**。

## 单一实体与串行保证

Durable Objects 由平台保证，**对于指定的 ID 或名称，在全球范围内始终仅存在一个唯一的实例**。

1. **唯一的位置**：无论从东京还是伦敦访问，只要指定相同的 `name`，请求都将被路由至地球上某个位置的同一个实例。
2. **消息串行**：针对该实例的方法调用或 HTTP 请求将被积压在队列中，**依次逐一进行串行执行**。由于内部不会同时运行多段代码，因此完全无需自行实现锁或事务隔离级别。
3. **非易失性持久化存储**：实例配备了专用的内置 SQLite 存储（`ctx.storage`），不仅能存储内存变量，将数据保存到磁盘的操作也在单个节点内完成。

## 开发者需掌握的特性

- 从客户端出发，可以通过绑定以 RPC（远程过程调用）形式直观地调用方法。
- 一旦访问中断，实例会自动从内存中退避（hibernate），从而避免产生不必要的计费。在下次请求到达的瞬间，将在几毫秒内恢复。
- 通过调用 `ctx.storage.setAlarm()`，可以在未来的特定时间自动启动实例，执行定时处理或清理工作。

## 内存状态与 SQLite 存储的区别

DO 有两个存放状态的地方：**类字段（内存）** 和 **`ctx.storage`（SQLite）**。

|        | 内存（类字段）                              | SQLite（`ctx.storage`）              |
| ------ | ------------------------------------------- | ------------------------------------ |
| 速度   | 最快（仅读内存）                            | 很快（同一机器上的磁盘，可同步调用） |
| 持久性 | 休眠、退避、崩溃、代码更新时**丢失**        | 跨重启与部署**保留**                 |
| 适用   | 缓存、已连接 WebSocket 列表、写入前的批处理 | 所有作为事实来源的数据               |

丢失的条件是明确的：约 10 秒无访问被退避时、因未捕获异常崩溃时、部署新代码时（默认最多有约 5 分钟的宽限）。再次被调用时 `constructor()` 会重新执行，字段回到初始值。

因此事实来源总是先写入 SQLite，内存只用来加速读取。常规做法是在构造函数中从 SQLite 读回并预热字段。

```ts
export class ChatRoom extends DurableObject {
  // 退避后丢失也无妨的读取缓存
  recent: Message[] | null = null;

  addMessage(text: string) {
    // 先持久化，再丢弃缓存
    this.ctx.storage.sql.exec('INSERT INTO messages (text) VALUES (?)', text);
    this.recent = null;
  }
}
```

## WebSocket 与 Hibernation API

聊天这类需要长期保持连接的场景，是 DO 最擅长的领域。所有人都连接到同名的 DO，因此广播不需要额外机制。

使用标准的 `ws.accept()` 时，只要连接存活，DO 就会驻留内存，并在这段时间内持续计费。**Hibernation API** 通过 `this.ctx.acceptWebSocket(ws)` 托管连接，并由 `webSocketMessage()` / `webSocketClose()` 处理器接收事件。没有消息时，DO 可以被退避出内存，而连接不会断开。

但退避后字段会丢失。每个连接的少量信息（如用户名）保存在 `ws.serializeAttachment()` 中，唤醒时用 `ws.deserializeAttachment()` 恢复。历史记录放进 SQLite。也就是说，Hibernation 以遵守上表的分工为前提。

在下一章 [自己编写 Durable Object](/lessons/durable-object-class) 中，可以通过改写代码来确认两种状态的区别。

编辑器中的 `env.COUNTER` 就是实际运行中的 Durable Object 实例。通过重复执行代码，可以确认即使进程重启，计数器也能确保持续递增。
