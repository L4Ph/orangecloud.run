# 学习环境架构（Dynamic Workers）

在构建能够安全地执行用户编写的任意代码的沙箱（Sandbox）时，传统的做法通常是在后端运行庞大的 Docker 容器。但容器方式在每次执行时都会产生数秒的启动延迟，且服务器实例的维护成本也十分高昂。

本学习环境的 JavaScript 和 Python 课程不使用容器，而是在 **Dynamic Workers（Worker Loader 绑定）**上运行。父 Worker 根据接收到的请求，按需在内存中构建子 V8 isolate，并在毫秒级别将其一次性丢弃。Containers 各章以及自己编写 Durable Object 的那一章，则在容器和 Durable Object 这两种其他运行时上运行。

## 动态 Worker 的构建与启动

父 Worker 将用户发送的代码与始终以 JSON 返回结果的包装器一起汇总为模块，并通过 `env.LOADER` 实例化子 Worker。

```ts
import { exports } from "cloudflare:workers";

// ID 由包装器版本和规范化后代码的 SHA-256（前 128 位）生成
const id = `run-${WRAPPER_VERSION}-${await hash(normalize(code))}`;
const worker = env.LOADER.get(id, () => ({
  compatibilityDate: "2026-02-24",
  mainModule: "index.js",
  modules: { "index.js": wrapped, "user.js": code },
  env: {
    KV: exports.LessonKv({ props: { prefix: "playground/" } }),
    STORAGE: exports.LessonR2({ props: { prefix: "playground/" } }),
    AI: exports.LessonAi({ props: {} }),
    COUNTER: exports.LessonCounter({ props: {} }),
    DB: exports.LessonDb({ props: {} }),
  },
  globalOutbound: null, // 阻断所有向外部网络的外向通信
  limits: { cpuMs: 100, subRequests: 20 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **通过 `globalOutbound: null` 切断网络**：子 Worker 中的 `fetch()` 和 `connect()`（TCP 连接）都会抛出异常。与外部的通信通道只有父端交给它的五个暂存对象，因此可以防止恶意脚本进行非法的外部通信。
- **资源上限**：将 CPU 执行时间限制在最大 100ms。即使输入了包含无限循环或过度运算的代码，达到上限的子 Worker 也会立即抛出异常。
- **isolate 的缓存复用**：`env.LOADER.get(id, factory)` 按 ID 缓存 isolate。ID 相同时，可能会复用已有的 isolate，但不保证一定复用。已加载的 Worker 会在不核对代码的情况下被复用，因此 ID 由规范化后代码的 SHA-256（前 128 位）生成，避免不同的代码得到相同的 ID。
- **固定兼容性日期**：该编辑器中的 Worker 以兼容性日期 2026-02-24、不带 `nodejs_compat` 运行，因此 `process` 不存在。

## 绑定的注入边界

能放进子 Worker `env` 的只有两类：支持结构化克隆（Structured Clone）的数据类型，以及 Service Binding。D1、KV、R2、AI 和 Durable Object 暂存对象都不属于这两类，因此无法直接传递。放进 `env` 会以 `DataCloneError` 失败。

因此，父 Worker 为每个绑定导出一个 `WorkerEntrypoint` 类，并把它的暂存对象（`exports.LessonKv({ props })`）交给子 Worker。子 Worker 可以像普通绑定一样调用 `env.KV.get()`。每次调用都是回到父端的 RPC，由父端针对真实资源执行。这些类位于 `src/lib/lesson-bindings.ts`。

| 资源            | 子 Worker 得到的东西                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| KV / R2         | `LessonKv` / `LessonR2`。键被限制在 `props.prefix` 之下，因此碰不到应用的其他键                                 |
| D1 数据库       | `LessonDb`。`prepare(sql).bind(...).run()` 的链式调用会依次返回暂存对象。没有按前缀划分，所有人共用同一个数据库 |
| Workers AI      | `LessonAi`。每次调用都会计费，因此只提供课程用的一个模型和较小的输入                                            |
| Durable Objects | `LessonCounter`。转发到 Durable Object 的暂存对象。名称固定，所有人共用同一个计数器                             |

子 Worker 只能看到这五个暂存对象，无法触及父端的 `env`、`ctx`，以及类中未写出的方法。通过 Service Binding 的调用会计入子请求上限，因此每次执行限制为最多 20 次。

## 多租户执行的防线

1. **防止缓存分裂**：先把 CRLF 统一为 LF 并去掉末尾的换行，再计算哈希值，避免内容相同的代码被算作不同的 Worker。空格等可能改变行为的差异不做规范化。
2. **通过速率限制防止过载**：按客户端 IP 限制执行端点的调用次数（容器和 Durable Object 的执行限制更严格），防止自动化脚本发起的过载攻击。上限按 Cloudflare 的各个位置分别统计，只是近似值。
3. **成本控制**：Dynamic Workers 按每天创建的唯一 Worker（由 ID 和代码共同确定）的数量计费，此外还按请求数和 CPU 时间（含启动时间）计费，且需要付费方案。未经修改的教材代码由所有人共用同一个 Worker，因此唯一数量不会增加。修改过的代码每当内容变化就会成为新的 Worker，所以按 IP 的速率限制才是上限。
