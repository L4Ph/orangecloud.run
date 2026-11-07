# Durable Objects 与 Actor 模型

Durable Objects（DO）常被描述为“有状态的小服务器”，其实是 **Actor 模型**的实现。理解 Actor 模型，就能明白为什么 DO 用类来写、为什么方法调用会被串行化。

## Actor 模型的约定

Actor 系统（Erlang 进程、Akka Actor）由四件事构成。

1. **同一性**：每个 actor 都能用名字指代，同名即同一实体
2. **私有状态**：状态只在 actor 内部，外部无法直接访问
3. **消息**：与外界只通过消息交互，消息进入邮箱排队
4. **一次一个**：actor 逐个处理消息，内部不会产生竞态

不需要共享内存和锁，也不用关心实体在哪里（location transparency）。

## 与 Durable Objects 的对应

| Actor 模型   | Durable Objects                                        |
| ------------ | ------------------------------------------------------ |
| actor 的名字 | `env.ROOM.get(env.ROOM.idFromName('room-1'))` 中的名字 |
| 私有状态     | `ctx.storage`（SQLite）与 `this` 上的字段              |
| 消息         | `fetch()`（HTTP）与 RPC 方法                           |
| 邮箱与串行化 | 平台保证，方法逐个执行                                 |
| 消亡与重生   | isolate 回收与 hibernation，状态留在 storage           |
| 位置         | 首次访问所在的 colo                                    |

## 为什么是类

**类是行为的单位，也是部署与迁移的单位**，实例则靠名字区分。

- 同一行为要创建成千上万个实例，所以“类型（类）”和“实例（名字）”必须分开
- 类名是绑定与 migration（`new_sqlite_classes`）的单位，换类就是换资源
- 方法就是消息处理器。RPC 有类型，`fetch` 面向 HTTP
- `this.ctx` 挂载 storage、alarm、id，能力属于实例
- 构造函数**每次激活都会执行**。字段是易失的，持久化在 storage —— 语言层面强迫你区分

若用函数加 KV 自己实现，就要重造串行化、排他、恢复与放置。

## 代码形态

```ts
export class Room extends DurableObject {
  async join(user: string) {
    const members = (await this.ctx.storage.get<string[]>('members')) ?? [];
    if (!members.includes(user)) members.push(user);
    await this.ctx.storage.put('members', members);
    return members;
  }

  async alarm() {
    // 30 分钟后被唤醒一次
    await this.ctx.storage.deleteAll();
  }
}
```

`join` 是 RPC 方法。两个并发调用会被逐个处理，`members` 不会被破坏。

## 限制

- **内部没有并行**：一个 DO 大约相当于一个核心的吞吐。热点键要拆分（按用户、按房间）
- 其他消息**只在 `await` 处**插入。跨 await 读状态要小心顺序
- 不适合扫描大量行。聚合放 D1，字节放 R2
- 位置由首次访问决定。把全世界的请求都汇到一个 DO 会很慢
- 空闲时不计费（hibernation）。WebSocket 用 Hibernation API

## 适合 actor 的问题

聊天室、库存、游戏房间、限流器、工作流协调者、AI 代理的记忆。**“同一个名字的状态，同一时刻只有一个调用者”**就是 DO。读多的列表和聚合交给 D1，字节交给 R2。
