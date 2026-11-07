# Containers（容器执行环境）

V8 isolate 启动仅需毫秒，能流畅地处理数千个请求。但当你想用 FFmpeg 转码视频、使用 Playwright 驱动无头浏览器，或者运行用 C 语言编写的巨大二进制文件时，就会被 isolate 的壁垒挡住。因为 OS 的内核功能以及任意文件的执行权限在那里都不存在。

Cloudflare Containers 是针对 isolate 无法解决的挑战的**最后手段**。它能将自定义的 Docker 镜像直接部署到边缘端，并在 Durable Objects 后面根据需要启动和停止完整的 Linux 容器。

## isolate 与容器的权衡

| 比较项目   | V8 isolate（Dynamic Workers） | Cloudflare Containers               |
| ---------- | ----------------------------- | ----------------------------------- |
| 启动时间   | 数毫秒（立即开始响应）        | 数秒量级（等待容器启动）            |
| 内存上限   | 128MB 起（轻量级设计）        | 可分配数 GB                         |
| 可执行文件 | JS、TS、Wasm、Pyodide         | 任意 Linux 可执行文件、共享库       |
| 计费单位   | 执行 CPU 时间                 | 容器启动时间（vCPU 分钟、GiB 小时） |

如果仅是中继 Web API 请求，isolate 要快得多，且成本更低。**首先彻底思考是否能单独通过 Workers 实现，仅在绝对不可能的情况下才引入容器**，这是边缘端设计的铁律。

## 通过 Sandbox SDK 控制容器

若要从代码中操作容器，则使用 Cloudflare 的 Sandbox SDK（`@cloudflare/sandbox`）。可以在 Worker 内部按需调用容器实例，执行 shell 命令或开放端口。

```ts
import { getSandbox } from "@cloudflare/sandbox";

// 为每个用户 ID 或会话预留独立的沙箱
const sandbox = await getSandbox(env.SANDBOX, "user-session-123");

// 在容器内部执行命令并接收标准输出
const result = await sandbox.run("node --version");
console.log("Container Node.js:", result.stdout);
```

容器在请求中断时会自动进入睡眠状态，仅计费其被主动使用的时间。
