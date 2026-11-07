# Durable Objects 与 Actor 模型

Durable Objects（DO）是一种将计算与存储结合在一起的特殊 Worker。其机制可以用并发计算的经典理论——**Actor 模型（Actor Model）**来解释，Cloudflare 的文档也指出每个 DO 都可以视为一个 Actor。理解了这一点，就更容易明白 DO 为什么采用面向对象的类语法来定义，以及为什么单个实例内部的 JavaScript 不会同时运行。不过，DO 与严格的 Actor 模型也有不同之处，例如在 `await` 的间隙，其他处理可能插入进来（见最后一节）。

## Actor 模型强制执行的 4 项约定

以 Erlang 的进程和 Akka 的 Actor 为代表的 Actor 模型，为了在分布式环境中安全地维护状态，规定了以下约定：

1. **唯一标识（Identity）**：所有 Actor 都由唯一的标识名称（ID 或名称）指代。只要指定相同的名称，就能访问物理上相同的实体。
2. **私有状态（Private State）**：状态仅封闭在 Actor 内部，外部进程无法直接窥视内存。
3. **消息传递（Message Passing）**：Actor 之间的所有交互仅通过异步消息的发送和接收完成。收到的消息按顺序堆叠在收件箱中。
4. **一次只处理一个（Turn-based Processing）**：Actor 从收件箱中逐个取出消息并依次处理。由于内部不会同时运行多个处理逻辑，因此不会发生竞态条件（Race Condition）。

这些约定使我们既能避开共享内存互斥控制和分布式锁的复杂性，也可以把状态的物理位置（位置透明性）交给平台处理。

## Durable Objects 与 Actor 的对应关系

| Actor 模型概念     | Cloudflare Durable Objects 的实现                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Actor 的标识名称   | `env.ROOM.idFromName('room-1')` 生成的唯一 ID                                                                        |
| 私有状态           | `this.ctx.storage`（内置 SQLite）以及 `this` 的实例变量                                                              |
| 消息               | 定义在类中的类型化 RPC 方法，或 `fetch()`                                                                            |
| 收件箱与串行执行   | 在单线程上运行。在 `await` 非存储 I/O（如 `fetch()`）期间，其他请求可能插入                                          |
| Actor 的消亡与复活 | 空闲约 10 秒后从内存中退避（Hibernation）。下一个事件到来时 `constructor()` 会重新执行并重建对象，内存中的状态会丢失 |
| 物理位置           | 原则上在首次向该实体发送请求的边缘（Colo）附近                                                                       |

## 为什么使用类而非函数

使用类语法的原因在于，**类是“行为的定义单位”，同时也是管理 DO 命名空间及其生命周期（创建、重命名、删除、转移）的单位**。部署的单位是 Worker，而不是类。

如果要生成数万个具有相同行为的 Actor 实体，且每个实体针对房间名或用户名分别生成，为了满足这一需求，必须将表示行为的“类型（Class）”与持有个体状态的“实例（Name）”明确分离。

```ts
export class ChatRoom extends DurableObject {
  async join(user: string) {
    const members = (await this.ctx.storage.get<string[]>("members")) ?? [];
    if (!members.includes(user)) {
      members.push(user);
      await this.ctx.storage.put("members", members);
    }
    return members;
  }

  async alarm() {
    // 在通过 `setAlarm()` 设定的时间被唤醒，清除此 DO 中存储的全部数据
    await this.ctx.storage.deleteAll();
  }
}
```

即使多个客户端同时调用 RPC 方法 `join`，在读取和写入数组之间也不会有其他处理插入而导致数据损坏。因为在 `await` 存储操作期间，输入门（input gate）会暂缓投递其他事件。

## 需要考虑的吞吐量边界

- **单个 Durable Object 在单线程上运行，对于简单操作，每秒 500–1,000 个请求左右是一个参考值**（每个对象的软限制为每秒 1,000 个请求，超过后会返回过载错误）。如果将数十万次访问集中在一个 DO 实例上，自然会产生瓶颈。基本设计应将实例细分部署在每个房间、每个租户、每个用户 ID 中。
- **在 `await` 非存储 I/O（如 `fetch()` 或 R2）期间，其他请求的处理可能插入进来（Interleaving）**。在 `await` 存储操作期间，输入门会暂缓投递其他事件，因此不会被插入。如果插入的请求可能破坏状态的不变条件，应使用 `blockConcurrencyWhile()`，或先检查版本号再写入的乐观锁加以保护。
- 处于可休眠状态的空闲实例不会产生时长（GB 秒）费用。如果存在未完成的定时器或标准 WebSocket（`ws.accept()`），即使空闲也会持续计费。对于常时连接的 WebSocket，使用 Hibernation API 即可在保持连接的同时避免等待期间的时长费用。
