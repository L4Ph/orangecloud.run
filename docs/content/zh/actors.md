# Durable Objects 与 Actor 模型

Durable Objects（DO）通常被介绍为“具有状态的小型服务器”。但其本质是并发计算经典理论——**Actor 模型（Actor Model）**的纯粹实现。理解了这一背景，就能明白为什么 DO 采用面向对象的类语法来定义，以及为什么方法调用必须逐一串行执行。

## Actor 模型强制执行的 4 项约定

以 Erlang 的进程和 Akka 的 Actor 为代表的 Actor 模型，为了在分布式环境中安全地维护状态，规定了以下约定：

1. **唯一标识（Identity）**：所有 Actor 都由唯一的标识名称（ID 或名称）指代。只要指定相同的名称，就能访问物理上相同的实体。
2. **私有状态（Private State）**：状态仅封闭在 Actor 内部，外部进程无法直接窥视内存。
3. **消息传递（Message Passing）**：Actor 之间的所有交互仅通过异步消息的发送和接收完成。收到的消息按顺序堆叠在收件箱中。
4. **单次处理（Turn-based Processing）**：Actor 从收件箱中逐个取出消息并依次处理。由于内部不会同时运行多个处理逻辑，因此不会发生竞态条件（Race Condition）。

其最大优势在于，无需担心共享内存的互斥控制或分布式锁的复杂性，而是可以将状态的物理位置（位置透明性）交给平台处理。

## Durable Objects 与 Actor 的对应关系

| Actor 模型概念     | Cloudflare Durable Objects 的实现                             |
| ------------------ | ------------------------------------------------------------- |
| Actor 的标识名称   | `env.ROOM.idFromName('room-1')` 生成的唯一 ID                 |
| 私有状态           | `this.ctx.storage`（内置 SQLite）以及 `this` 的实例变量       |
| 消息               | 定义在类中的类型化 RPC 方法，或 `fetch()`                     |
| 收件箱与串行执行   | 基础设施层完全保证。方法调用逐一串行执行                      |
| Actor 的消亡与复活 | 内存不足时的休眠（Hibernation），以及下次请求到达时的即时恢复 |
| 物理位置           | 原则上在首次向该实体发送请求的边缘（Colo）附近                |

## 为什么使用类而非函数

强制使用类语法的原因在于，**类才是“行为的定义单位”，同时也是“部署与模式迁移的最小单位”**。

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
    // 在设定的闹钟时间起床，清除旧消息
    await this.ctx.storage.deleteAll();
  }
}
```

即使 RPC 方法 `join` 同时被多个客户端访问，内部也会确保逐一串行执行。无需担心在数组读写的间隙被其他处理插入而导致数据损坏。

## 需要考虑的吞吐量边界

- **单个实例的吞吐量被限制在相当于 1 个 CPU 核心的水平**。如果将数十万次访问集中在一个 DO 实例上，自然会产生瓶颈。基本设计应将实例细分部署在每个房间、每个租户、每个用户 ID 中。
- **在使用 `await` 等待异步处理的间隙，可能会被其他消息处理插入（Interleaving）**。在维护状态一致性时，需要留意 `await` 前后的状态不变条件是否被破坏。
- 空闲状态的实例会自动进入休眠状态，CPU 费用为零。在处理常时连接的 WebSocket 时，利用 Hibernation API 即可避免产生维持连接的等待费用。
