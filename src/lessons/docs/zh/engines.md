# JavaScript 引擎与运行时

一旦尝试在浏览器之外运行 JavaScript，执行环境必然会分为两个部分：一个是解析源代码并以字节码或机器语言形式执行的**引擎**，另一个是将网络、定时器等外部世界与该引擎连接起来的**运行时**。如果不意识到这一分界线，就无法洞察 Cloudflare Workers 的架构。

## 引擎（负责执行的核心部分）

| 引擎               | 主要应用场景                                 | 特点                                                      |
| ------------------ | -------------------------------------------- | --------------------------------------------------------- |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | Google 开发。具备多级 JIT 编译器                          |
| **SpiderMonkey**   | Firefox（Gecko）                             | Mozilla 开发。JIT 为 Baseline 与 Warp（IonMonkey 的后继） |
| **JavaScriptCore** | Safari（WebKit）/ Bun                        | Apple 开发。以解释器加三级 JIT 执行                       |
| **QuickJS**        | 嵌入式/轻量级环境                            | 数百 KB 级。无需 JIT，极小且可立即启动                    |
| **Hermes**         | React Native                                 | 以 AOT 编译为前提。优先考虑启动时间与内存                 |

引擎负责的是 ECMAScript（JavaScript 的语言规范）和 WebAssembly 的执行。它读取源代码，构建抽象语法树，以字节码或机器语言形式执行。它提供 `Array`、`Promise` 等内置对象，并通过垃圾回收（GC）回收不再需要的内存。ECMAScript 规范中既不包含打开文件的功能，也不包含等待网络套接字的功能。

## 运行时（与外部世界的连接点）

运行时是为引擎提供与“外部世界”对话的手段。

| 运行时                 | 引擎           | 与外部世界的接口                                                                      |
| ---------------------- | -------------- | ------------------------------------------------------------------------------------- |
| **Node.js**            | V8             | 通过 libuv 进行 OS 系统调用。`fs`、`net`、`process`                                   |
| **Bun**                | JavaScriptCore | 以 Rust 编写的原生实现。`Bun.serve`、`Bun.file`。**2025 年 12 月被 Anthropic 收购**   |
| **Deno**               | V8             | Rust 开发。细粒度权限模型（`--allow-net` 等）。**2026 年 10 月加入 Cloudflare**       |
| **Cloudflare Workers** | V8             | 边缘端的隔离环境。运行时为开源的 workerd。Web 标准 API（`fetch` 等）+ Cloudflare 绑定 |

既然都搭载了相同的 V8 引擎，Node.js 和 Workers 应该能以同样的方式运行——如果抱着这样的想法带入代码，最初几行就会栽跟头。Workers 没有本地磁盘，以 ES modules 形式编写的 Worker 里也没有 `require`。`process` 和 `node:fs` 由兼容层（`nodejs_compat`）提供，兼容性日期（compatibility date）在 2026-08-04 及以后的 Worker 默认启用该兼容层。不过 `node:fs` 的实体是内存中的虚拟文件系统。

Workers 的基础是浏览器中熟悉的 Web 标准（`fetch`、`Request`、`Response`、`crypto`）以及平台特定的绑定。

支撑 Workers 的 **V8 isolate** 既不是 OS 进程，也不是独立的容器。它将数百到数千个独立的执行空间塞进单个 OS 进程中。每个 isolate 都拥有独立的内存空间，而且据 Cloudflare 介绍，其启动速度比容器或虚拟机上的 Node 进程快约 100 倍。

执行编辑器中的代码时，会输出全局空间的验证结果。该编辑器中的 Worker 以兼容性日期 2026-02-24、不带 `nodejs_compat` 运行，因此 `process` 不存在。输出中的 `navigator = object` 是一个对象，其 `navigator.userAgent` 返回 `Cloudflare-Workers`，可用来判断运行环境。请确认该环境中存在什么，以及哪些内容被剔除了。

```js
typeof process; // undefined（没有 Node.js 的痕迹。启用 nodejs_compat 后为 object）
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined（没有浏览器的 DOM）
typeof caches; // object（Cache API，与浏览器版本有差异）
```
