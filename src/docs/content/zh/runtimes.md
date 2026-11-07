# 运行时架构对比（Node.js 与 V8 isolate）

服务端 JavaScript 的历史长期以来一直被视为与 Node.js 架构相同。然而，面对边缘计算所要求的“极短启动时间”、“极高容量密度”以及“安全的多租户隔离”，Node.js 的基础架构成为了巨大的绊脚石。

通过理解支撑 Cloudflare Workers 的 **V8 isolate** 剔除了哪些部分、保留了哪些部分，可以在边缘环境下做出精准的设计决策。

## 进程模型与隔离架构的根本差异

Node.js 默认为单个 OS 进程分配一个 V8 实例（isolate）。使用 `worker_threads` 可以在同一进程中增加 isolate，但每个 isolate 都附带一个 libuv 事件循环。在其外部，分布着 libuv 的线程池和套接字的管理机制。这种结构以单个进程持久驻留为前提，不适合每次请求都新建并销毁进程的运作方式。

```
[Node.js 的进程结构]
OS 进程 ── libuv (C / 线程池 / 文件 I/O / 网络套接字)
         └── 单个 V8 实例 (所有请求共享堆与状态)

[Workers 的 isolate 结构]
运行时进程 ── 隔离边界 (内存保护、权限沙箱)
            ├── isolate A (用户 A 的堆 / 独立内存空间)
            ├── isolate B (用户 B 的堆 / 独立内存空间)
            └── isolate C (用户 C 的堆 / 独立内存空间)
```

Cloudflare Workers 隐藏了 OS 进程层，将 **V8 isolate 单体** 作为执行的基本单位。运行时的单个实例可以在内存空间彼此隔离的数百至数千个 isolate 之间切换运行。

访问 isolate 之外的内存，会被 V8 阻止。Cloudflare 还在此之上通过 Linux 的 namespace 和 seccomp 禁止进程访问文件系统和网络，并把信任级别不同的 Worker 放入不同的运行时实例。由于 V8 也存在漏洞，Cloudflare 将 V8 补丁从发布到部署上线的间隔控制在不到 24 小时。

## 容器与 isolate 的启动时间

启动容器（如 Docker）必须经过一系列步骤：容器镜像的层级展开、Linux 命名空间（Namespace）的初始化、虚拟网络接口的配置以及客户机进程的启动。在 Cloudflare Containers 中，每个实例都运行在拥有独立内核的 Firecracker microVM 内，冷启动通常需要 1 到 3 秒（取决于镜像大小和代码）。

相比之下，isolate 只需在已运行的运行时内创建，不必启动进程或虚拟机。据 Cloudflare 介绍，isolate 的启动速度比容器或虚拟机上的 Node 进程快约 100 倍。不过 Worker 的冷启动包括获取脚本、编译以及执行顶层代码。脚本越大、顶层处理越重，耗时越长。启动时间有 1 秒的上限。

## 架构选择边界

| 处理性质                               | 最佳选择                               | 依据                                                                                          |
| -------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Web API、轻量级业务逻辑、数据中继      | **V8 isolate（Workers）**              | isolate 启动快，空闲成本为零                                                                  |
| 运行 Linux 二进制的处理（如 FFmpeg）   | **Cloudflare Containers**              | 需要完整的 Linux 内核和二进制执行环境                                                         |
| 无头浏览器操作（Playwright）           | **Browser Run**                        | 可从 Worker 通过 Playwright 操作                                                              |
| 长时间批处理                           | **Workflows / Queues / Cron Triggers** | Cron 和 Queue consumer 最长 15 分钟；Workflows 单个步骤的耗时没有上限（CPU 时间上限仍然存在） |
| 等待外部连接（DB 查询、外部 REST API） | **V8 isolate（Workers）**              | 按请求数和 CPU 时间计费，网络等待的时间不计费                                                 |
| 对单一资源的串行化与互斥控制           | **Durable Objects**                    | 将请求聚合至全球唯一的实例                                                                    |

在引入适用于 Node.js 的库时，请使用 `nodejs_compat` 兼容性标志。兼容性日期（compatibility date）在 2026-08-04 及以后的 Worker 默认启用该标志。除 `Buffer`、`crypto`、`events` 外，`process`、`node:fs`、`node:http`、`node:net`、`node:zlib` 等也已内置，但 `child_process` 这类模块只能导入、无法实际运行。另外，`node:fs` 的实体是内存中的虚拟文件系统，可写入的 `/tmp` 是每次请求独立的临时区域。以持久化本地磁盘为前提的设计无法成立。
