# 学习环境架构（Dynamic Workers）

在构建能够安全地执行用户编写的任意代码的滤箱（Sandbox）时，传统的做法通常是在后端运行庞大的 Docker 容器。但容器方式在每次执行时都会产生数秒的启动延迟，且服务器实例的维护成本也十分高昂。

在本学习环境中，我们完全不使用容器，而是采用了 **Dynamic Workers（Worker Loader 绑定）**。父 Worker 根据接收到的请求，按需在内存中构建子 V8 isolate，并在毫秒级别将其一次性丢弃。

## 动态 Worker 的构建与启动

父 Worker 将用户发送的代码汇总为模块，并通过 `env.LOADER` 实例化子 Worker。

```ts
const worker = env.LOADER.get(`sandbox-${hash(code)}`, () => ({
  compatibilityDate: "2026-02-24",
  mainModule: "index.js",
  modules: { "index.js": wrapUserCode(code) },
  env: { KV: kvProxyStub, DB: env.DB },
  globalOutbound: null, // 阻断所有向外部网络的外向通信
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **通过 `globalOutbound: null` 实现完全隔离**：子 Worker 内部完全无法对互联网上的任意服务器发起 `fetch()` 或建立 Raw 套接字。这在物理上封锁了恶意脚本进行的非法外部通信或凭据窃取。
- **严格的资源上限**：将 CPU 执行时间限制在最大 100ms。即使输入了包含无限循环或过度运算的代码，也仅会终止子 isolate，而不会耗尽父 Worker 的资源。
- **isolate 的缓存复用**：使用 `env.LOADER.get(id, factory)`，针对相同代码（哈希值匹配的代码）复用现有的 isolate。这防止了不必要的内存重新分配，从而将成本和延迟降至最低。

## 绑定的注入边界

能够直接传递给子 Worker `env` 的对象有限制。仅限于支持结构化克隆（Structured Clone）的数据类型以及 Service Binding。

| 资源            | 传递给子 Worker 的方式                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------- |
| D1 数据库       | 由于原生支持结构化克隆，直接传递                                                                   |
| Durable Objects | 作为通过 `namespace.get(id)` 获取的暂存对象（Service Binding）传递                                 |
| KV / R2 / AI    | 由于命名空间本身无法直接克隆，因此由父端通过 Durable Object 或 Service Binding 的 RPC 代理进行中继 |

例如对于 KV，部署在父环境中的 Durable Object 负责 `get` / `put` / `delete` / `list` 的处理程序，并将该 RPC 暂存作为 `env.KV` 注入到子环境中。子 Worker 内部的代码可以将其作为与真实 KV 命名空间完全相同的接口透明地使用。

## 多租户执行的防线

1. **防止隐式缓存污染**：在计算哈希值前对代码中的空格和换行符进行规范化处理，以防止非预期的缓存分裂。
2. **通过速率限制防止过载**：按客户端 IP 限制执行端点的调用次数（容器的限制更严格），防止自动化脚本发起的过载攻击。上限按 Cloudflare 的各个位置分别统计，只是近似值。
3. **成本防线**：Dynamic Workers 根据“每天生成的唯一 Worker 数量”计费。通过让多名用户共享教材代码的初始状态，实现了将计费对象的唯一 Worker 数量降至最低的设计。
