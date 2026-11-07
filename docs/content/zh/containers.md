# Containers

Workers（isolate）不够用时的**最后手段**。可以直接运行 Docker 镜像，Cloudflare 在 Durable Object 背后启停容器。

## isolate 不够用的例子

- 原生二进制或很重的依赖（ffmpeg、Python 科学计算、Playwright）
- 长时间运行的进程（WebSocket 服务器、游戏服务器）
- 需要超过 128MB 内存的处理
- 想原样复用已有的 Docker 镜像

反过来，如果只是“等 HTTP”或“查数据库”，isolate 更快也更便宜。**先想能不能用 Workers 写**是原则。

## 代码形态

```ts
import { getSandbox } from '@cloudflare/sandbox';

const sandbox = await getSandbox(env.SANDBOX, 'user-123');
const result = await sandbox.run('node --version');
```

使用 Cloudflare 的 Sandbox SDK（`@cloudflare/sandbox`）时，Worker 可以通过 `getSandbox()` 拿到容器，执行 `run`、文件操作和端口公开。

## 费用与启动

| 项目 | 付费套餐                   |
| ---- | -------------------------- |
| 内存 | 每月含 25 GiB 小时         |
| CPU  | 每月含 375 vCPU 分钟       |
| 启动 | 秒级（isolate 是毫秒级）   |
| 休眠 | 空闲后休眠，仅使用期间计费 |

**启动要秒级，而且即使不用也要为镜像构建和放置付费**，所以教学沙箱更适合 isolate（Dynamic Workers）。本站也是这个架构。

构建容器需要 Docker 与 Workers 付费套餐，所以这里只给出代码示例。
