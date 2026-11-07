# Containers（边缘容器）

V8 isolate 的限制是刻意设计的。通过占用文件系统、禁止常驻进程并将内存限制在 128MB，实现了毫秒级的启动速度和数万个并发的规模。然而，在实际工作负载中，必然存在会超出 isolate 边界的处理逻辑。

无论是使用 FFmpeg 进行视频编码、通过 Playwright 控制无头浏览器、运行 C/C++ 编写的现有二进制文件，还是需要数 GB 内存的高负载数据处理，这些都离不开 Linux 内核的完整功能。

Cloudflare Containers 正是针对此类场景的**最后一张王牌**。通过将标准 Docker 镜像引入边缘环境，并结合 Durable Objects 的生命周期控制，实现完全的 Linux 容器按需运行。

## 架构对比

| 评估维度 | V8 isolate（Workers） | Cloudflare Containers |
| --- | --- | --- |
| 启动延迟 | 1 〜 5 毫秒 | 数秒量级（镜像解压、启动） |
| 内存分配 | 128MB 〜 | 可按多个 GiB 单位配置 |
| 运行时环境 | Web 标准 API、Wasm、Pyodide | 完整的 Linux（Debian、Alpine、Ubuntu 等） |
| 最适用领域 | API 路由、认证、轻量级转换 | 高负载批处理、媒体转换、沙箱执行 |

对于“接收 HTTP 请求并访问数据库”这类典型处理，isolate 的响应速度要快得多，资源效率也更高。在边缘设计中，**首先尝试仅靠 Workers 解决所有问题，直到发现 OS 原生二进制文件或大量内存不可或缺时，才采用容器**，这是避免设计失效的原则。

## 通过 Sandbox SDK 实现生命周期控制

调用容器时使用 Cloudflare Sandbox SDK（`@cloudflare/sandbox`）。在 Workers 端通过程序统一管理容器实例的生命周期，从而控制命令执行和内部端口的隧道化。

```ts
import { getSandbox } from '@cloudflare/sandbox';

// 获取以会话为单位隔离的沙箱环境
const sandbox = await getSandbox(env.SANDBOX, 'session-456');

// 在独立 Linux 环境的 shell 中执行命令
const execution = await sandbox.run('python3 -c "print(1 + 1)"');
console.log('stdout:', execution.stdout.trim());
```

容器在持续处于无通信状态时会自动停止，从而将 CPU 资源消耗降至最低。其结构设计确保了不会因长时间空闲状态而产生不必要的计费。
