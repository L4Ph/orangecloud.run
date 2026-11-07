# Containers（边缘容器）

V8 isolate 的限制是刻意设计的。不提供持久的文件系统、禁止常驻进程并将内存限制在 128MB，由此换来了毫秒级的启动速度和很高的并发能力。然而，在实际工作负载中，必然存在会超出 isolate 边界的处理逻辑。

使用 FFmpeg 进行视频编码、运行用 C/C++ 编写的现有二进制文件，或是需要数 GB 内存的高负载数据处理。这些都以操作系统的进程和文件系统为前提。如果只是控制无头浏览器，可以使用 Browser Run，在 Workers 中通过 Playwright 进行操作。

Cloudflare Containers 正是针对此类场景的**最后手段**。通过将标准 Docker 镜像引入边缘环境，并结合 Durable Objects 的生命周期控制，实现完全的 Linux 容器按需运行。

## 架构对比

| 评估维度   | V8 isolate（Workers）       | Cloudflare Containers                     |
| ---------- | --------------------------- | ----------------------------------------- |
| 启动延迟   | 毫秒级                      | 约 1〜3 秒（取决于镜像大小和启动处理）    |
| 内存分配   | 128MB（上限）               | 256 MiB 〜 12 GiB（按实例类型选择）       |
| 运行时环境 | Web 标准 API、Wasm、Pyodide | 完整的 Linux（Debian、Alpine、Ubuntu 等） |
| 最适用领域 | API 路由、认证、轻量级转换  | 高负载批处理、媒体转换、沙箱执行          |

对于“接收 HTTP 请求并访问数据库”这类典型处理，isolate 启动更快，资源效率也更高。在边缘设计中，**首先尝试仅靠 Workers 解决所有问题，直到发现 OS 原生二进制文件或大量内存不可或缺时，才采用容器**，这是避免设计失效的原则。

## 通过 Durable Object 实现生命周期控制

容器通过 Durable Object 的 `this.ctx.container` 来操作。Worker 按名称调用 Durable Object，由 Durable Object 用 `start()` 启动容器、用 `exec()` 执行命令，并用 `setInactivityTimeout()` 决定容器闲置多久后停止。`@cloudflare/sandbox`（1.0 及以后）只提供 `Files` 等辅助类，不负责容器的启动、停止和监控。这里使用的 `durable_object` 调度策略处于公开测试阶段，旧的 `default` 策略已被弃用。

```ts
import { DurableObject } from "cloudflare:workers";

// 在 cloudflare.config.ts 的 defineContainer 中，将 schedulingPolicy 设为 "durable-object"，
// 并为 images.default 声明 Dockerfile
export class Sandbox extends DurableObject {
  async run(argv: string[]) {
    const container = this.ctx.container;
    if (!container) throw new Error("未配置容器");

    if (!container.running) {
      // start() 不等待容器就绪即返回。exec() 会等待仍在启动中的容器
      container.start({
        image: container.images.default,
        instance: "lite", // 1/16 vCPU，256 MiB 内存
        entrypoint: ["sleep", "infinity"], // 主进程退出后容器也会停止
        enableInternet: false, // 不允许出站通信
      });
    }
    // Durable Object 进入非活动状态 10 分钟后停止（最长 6 小时）
    await container.setInactivityTimeout(10 * 60 * 1000);

    // exec() 不经过 shell，直接执行参数数组
    const process = await container.exec(argv);
    const { exitCode, stdout } = await process.output();
    return { exitCode, stdout: new TextDecoder().decode(stdout) };
  }
}

export default {
  async fetch(request: Request, env: { SANDBOX: DurableObjectNamespace<Sandbox> }) {
    // 每个会话使用独立的 Durable Object（独立的容器）
    const sandbox = env.SANDBOX.getByName("session-456");
    const { stdout } = await sandbox.run(["node", "--version"]);
    return new Response(stdout);
  },
};
```

容器会在 Durable Object 进入非活动状态后，经过 `setInactivityTimeout()` 指定的时间（最长 6 小时）后停止。未指定时，容器会在 Durable Object 进入非活动状态后立即停止。计费以 10 ms 为单位：运行期间即使空闲，内存和磁盘也按分配量计费，CPU 仅按实际使用量计费。容器停止后计费随之停止，但磁盘中的内容会丢失。Containers 可在 Workers Paid 方案中使用。
