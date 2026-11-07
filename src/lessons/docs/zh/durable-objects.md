# Durable Objects（分布式状态管理）

Workers 的优势在于，正因为不持有状态（stateless），能够在全球各端点快速扩展。然而，实际应用程序需要“全球唯一且绝对不能产生矛盾的状态”，例如协作编辑的光标同步、聊天室的参与者管理、限额票券的库存分配等。

如果依赖全局变量，不同 isolate 之间的值会产生偏差；而在普通数据库中，则会为并发写入的锁竞争而苦恼。为了解决这一困境，设计了 **Durable Objects（DO）**。

## 单一实体与串行保证

Durable Objects 由平台保证，**对于指定的 ID 或名称，在全球范围内同一时间只有一个实例在运行**。这种唯一性会在新事件开始时以及访问存储时得到检查。

1. **唯一的位置**：无论从东京还是伦敦访问，只要指定相同的 `name`，请求都将被路由至地球上某个位置的同一个实例。
2. **消息串行**：实例在单线程上运行，因此其方法调用和 HTTP 请求的 JavaScript 不会同时执行。只涉及存储操作的处理无需自行实现锁。在对 `fetch()` 等非存储 I/O 进行 `await` 期间，其他请求可能插入，因此需要用 `blockConcurrencyWhile()` 或乐观锁加以保护。
3. **非易失性持久化存储**：实例配备了专用的内置 SQLite 存储（`ctx.storage`），除了内存中的变量，还可以对专用的 SQLite 数据库进行同步读写。

## 开发者需掌握的特性

- 从客户端出发，可以通过绑定以 RPC（远程过程调用）形式直观地调用方法。
- 一旦不再有请求到达，实例会自动从内存中退避（hibernate），不再产生时长费用。下次请求到达时，`constructor()` 会重新执行，实例被重新创建。
- 通过调用 `ctx.storage.setAlarm()`，可以在未来的特定时间自动启动实例，执行定时处理或清理工作。

## 内存状态与 SQLite 存储的区别

DO 有两个存放状态的地方：**类字段（内存）** 和 **`ctx.storage`（SQLite）**。

|        | 内存（类字段）                              | SQLite（`ctx.storage`）              |
| ------ | ------------------------------------------- | ------------------------------------ |
| 速度   | 最快（仅读内存）                            | 很快（同一机器上的磁盘，可同步调用） |
| 持久性 | 休眠、退避、崩溃、代码更新时**丢失**        | 跨重启与部署**保留**                 |
| 适用   | 缓存、已连接 WebSocket 列表、写入前的批处理 | 所有作为事实来源的数据               |

丢失的主要情形如下：空闲约 10 秒进入休眠时（若仍有未完成的定时器、标准 WebSocket 或 I/O 则不会进入休眠，此时会在 70–140 秒后离开内存）、部署新代码时（默认最多有 5 分钟的宽限）、Workers 运行时更新时，以及运行时变更对象的托管位置时。再次被调用时 `constructor()` 会重新执行，字段回到初始值。

因此事实来源总是先写入 SQLite，内存只用来加速读取。常规做法是在构造函数中从 SQLite 读回并预热字段。

```ts
export class ChatRoom extends DurableObject {
  // 退避后丢失也无妨的读取缓存
  recent: Message[] | null = null;

  addMessage(text: string) {
    // 先持久化，再丢弃缓存
    this.ctx.storage.sql.exec("INSERT INTO messages (text) VALUES (?)", text);
    this.recent = null;
  }
}
```

## WebSocket 与 Hibernation API

聊天这类需要长期保持连接的场景，很适合使用 DO。所有人都连接到同名的 DO，因此广播不需要额外机制。

使用标准的 `ws.accept()` 时，只要连接存活，DO 就会驻留内存，并在这段时间内持续计费。**Hibernation API** 通过 `this.ctx.acceptWebSocket(ws)` 托管连接，并由 `webSocketMessage()` / `webSocketClose()` 处理器接收事件。没有消息时，DO 可以被退避出内存，而连接不会断开。

但退避后字段会丢失。每个连接的少量信息（如用户名）保存在 `ws.serializeAttachment()` 中，唤醒时用 `ws.deserializeAttachment()` 恢复。历史记录放进 SQLite。也就是说，Hibernation 以遵守上表的分工为前提。

在下一章 [自己编写 Durable Object](/lessons/durable-object-class) 中，可以通过改写代码来确认两种状态的区别。

编辑器中的 `env.COUNTER` 会把 `increment()` 和 `read()` 转发给本站提供的 Durable Object（名称为 `lesson-counter`）；与生产环境的绑定不同，不能通过 `idFromName()` 或 `getByName()` 选择实例。计数器由所有人共用，24 小时无人调用就会被删除。重复执行代码，可以确认即使进程重启，计数器也会继续递增。
