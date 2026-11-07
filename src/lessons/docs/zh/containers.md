# Containers（容器执行环境）

V8 isolate 启动仅需毫秒，能流畅地处理大量请求。但当你想用 FFmpeg 转码视频，或者运行用 C 语言编写的巨大二进制文件时，就会被 isolate 的壁垒挡住。因为 OS 的内核功能以及任意文件的执行权限在那里都不存在。

Cloudflare Containers 是针对 isolate 无法解决的挑战的**最后手段**。它能将自定义的 Docker 镜像直接部署到边缘端，并在 Durable Objects 后面根据需要启动和停止完整的 Linux 容器。

## isolate 与容器的权衡

| 比较项目   | V8 isolate（Workers）  | Cloudflare Containers                                         |
| ---------- | ---------------------- | ------------------------------------------------------------- |
| 启动时间   | 毫秒级（立即开始响应） | 数秒量级（等待容器启动）                                      |
| 内存上限   | 128MB（轻量级设计）    | 256 MiB 至 12 GiB（按实例类型选择）                           |
| 可执行文件 | JS、TS、Wasm、Pyodide  | 任意 Linux 可执行文件、共享库                                 |
| 计费单位   | 执行 CPU 时间和请求数  | 运行期间每 10 ms 计费（内存和磁盘按分配量，CPU 按实际使用量） |

如果仅是中继 Web API 请求，isolate 启动更快，资源效率也更高。**首先彻底思考是否能单独通过 Workers 实现，仅在绝对不可能的情况下才引入容器**，这是边缘端设计的铁律。

## 通过 Durable Object 控制容器

若要从代码中操作容器，请使用 Durable Object 的 `this.ctx.container`。由 Durable Object 用 `start()` 启动容器、用 `exec()` 执行命令、用 `getTcpPort()` 连接端口。`@cloudflare/sandbox`（1.0 及以后）只提供 `Files` 等辅助类。

```ts
import { DurableObject } from "cloudflare:workers";

// 在 cloudflare.config.ts 的 defineContainer 中，将 schedulingPolicy 设为 "durable-object"，
// 并为 images.default 声明 Dockerfile
export class Sandbox extends DurableObject {
  async nodeVersion() {
    const container = this.ctx.container;
    if (!container) throw new Error("未配置容器");

    if (!container.running) {
      container.start({
        image: container.images.default,
        entrypoint: ["sleep", "infinity"], // 主进程退出后容器也会停止
        enableInternet: false,
      });
    }
    await container.setInactivityTimeout(10 * 60 * 1000);

    // 在容器内部执行命令并接收标准输出
    const process = await container.exec(["node", "--version"]);
    const { stdout } = await process.output();
    return new TextDecoder().decode(stdout).trim();
  }
}

export default {
  async fetch(request: Request, env: { SANDBOX: DurableObjectNamespace<Sandbox> }) {
    // 为每个用户 ID 或会话预留独立的沙箱
    const sandbox = env.SANDBOX.getByName("user-session-123");
    return new Response(`Container Node.js: ${await sandbox.nodeVersion()}`);
  },
};
```

容器会在 Durable Object 进入非活动状态后，经过 `setInactivityTimeout()` 指定的时间（最长 6 小时）后停止。运行期间即使空闲，内存和磁盘也会计费；容器停止后，磁盘中的内容会丢失。Containers 可在 Workers Paid 方案中使用。
