# JavaScript 引擎与运行时

一旦尝试在浏览器之外运行 JavaScript，执行环境必然会分为两个部分：一个是解析语法树并将其转换为机器语言的**引擎**，另一个是将网络、定时器等外部世界与该引擎连接起来的**运行时**。如果不意识到这一分界线，就无法洞察 Cloudflare Workers 的架构。

## 引擎（负责执行的核心部分）

| 引擎               | 主要应用场景                                 | 特点                                      |
| ------------------ | -------------------------------------------- | ----------------------------------------- |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | 搭载 JIT 编译。速度快但二进制文件较大     |
| **SpiderMonkey**   | Firefox（Gecko）                             | 自最初就有的实现。搭载 JIT（Ion）         |
| **JavaScriptCore** | Safari（WebKit）/ Bun                        | Apple 开发。搭载 JIT，启动与内存效率极高  |
| **QuickJS**        | 嵌入式/轻量级环境                            | 数百 KB 级。无需 JIT，极小且可立即启动    |
| **Hermes**         | React Native                                 | 以 AOT 编译为前提。优先考虑启动时间与内存 |

引擎的职责极其有限。它读取源代码，构建抽象语法树，以字节码或机器语言形式执行，并通过垃圾回收（GC）回收不再需要的内存。仅此而已。引擎本身完全不具备打开文件的功能，也不具备等待网络套接字的功能。

## 运行时（与外部世界的连接点）

运行时是为引擎提供与“外部世界”对话的手段。

| 运行时                 | 引擎           | 与外部世界的接口                                                             |
| ---------------------- | -------------- | ---------------------------------------------------------------------------- |
| **Node.js**            | V8             | 通过 libuv 进行 OS 系统调用。`fs`、`net`、`process`                          |
| **Bun**                | JavaScriptCore | 自研原生实现（Zig/Rust）。`Bun.serve`、`Bun.file`                            |
| **Deno**               | V8             | Rust 开发。细粒度权限模型（`--allow-net` 等）。**2025 年被 Cloudflare 收购** |
| **Cloudflare Workers** | V8 isolate     | 边缘端的隔离环境。Web 标准 API（`fetch` 等）+ Cloudflare 绑定                |

既然都搭载了相同的 V8 引擎，Node.js 和 Workers 应该能以同样的方式运行——如果抱着这样的想法带入代码，在开头的几行代码就会被出其不意地击败。Workers 中既没有 `process`，也没有 `require`，甚至没有本地文件系统。

取而代之的是，浏览器中熟悉的 Web 标准（`fetch`、`Request`、`Response`、`crypto`）以及平台特定的绑定。

支撑 Workers 的 **V8 isolate** 既不是 OS 进程，也不是独立的容器。它将数千个独立的执行空间毫无间隙地塞进单个 OS 进程中。虽然拥有独立的内存空间，但启动时间仅需几毫秒。

执行编辑器中的代码时，会输出全局空间的验证结果。请确认该环境中存在什么，以及哪些内容被剔除了。

```js
typeof process; // undefined（没有 Node.js 的痕迹）
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined（没有浏览器的 DOM）
typeof caches; // object（Web 标准的 Cache API）
```
