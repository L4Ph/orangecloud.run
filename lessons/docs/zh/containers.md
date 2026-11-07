# 在 Containers 中运行

isolate（Workers）又快又便宜，代价是没有系统命令、没有原生库、没有文件系统。**Containers** 就是放弃这些限制的地方，可以直接运行 Docker 镜像。

本章的编辑器会把你写的 Python 放进容器里的文件，用 `python3` 执行，`print` 的输出会直接返回。

## 有什么不同

|      | isolate         | container                       |
| ---- | --------------- | ------------------------------- |
| 启动 | 毫秒            | 秒                              |
| 可用 | Web 标准 + 绑定 | 系统命令、任意二进制、pip / apt |
| 文件 | 无              | 有（但不持久）                  |
| 计费 | 请求 + CPU      | 运行时间 + 内存                 |

Python、ffmpeg、Playwright、带原生扩展的科学计算在 isolate 里跑不了。反过来，只是「等 HTTP」或「查数据库」的话，isolate 更快更便宜。

## 本站的做法

- 镜像用 `Dockerfile.sandbox`（Node 基础镜像 + `python3`）
- 用 `getSandbox('lesson-container')` 取一个容器并复用
- 每次运行写入 `/workspace/run-<id>.py`，执行 `python3`，结束删除
- 对外网络已关闭

```ts
const sandbox = await getSandbox('lesson-container');
await sandbox.files.writeFile('/workspace/main.py', code);
const result = await sandbox.run(['python3', 'main.py'], { cwd: '/workspace' });
```

## 注意

- 容器**启动要秒级**，空闲会停止，所以第一次运行较慢
- 运行期间计费，不适合高频处理
- 状态不会保留。要留下的东西放 D1 / R2 / KV

isolate 与容器的分界见 [深入运行时](/docs/runtimes)。
