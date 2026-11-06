# JavaScript 引擎与运行时

代码不会凭空运行。**引擎**解析并执行它，**运行时**为引擎接上“外部世界”。把这两件事分开看，Cloudflare Workers 的位置就一目了然了。

## 引擎（真正执行 JavaScript 的部分）

| 引擎               | 主要用途                                     | 特点                           |
| ------------------ | -------------------------------------------- | ------------------------------ |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | 带 JIT。最快一档，但二进制更大 |
| **SpiderMonkey**   | Firefox（Gecko）                             | 最早期的实现，带 JIT（Ion）    |
| **JavaScriptCore** | Safari（WebKit）/ Bun                        | Apple 出品，带 JIT 且体积小    |
| **QuickJS**        | 嵌入式、小型环境                             | 几百 KB 级。没有 JIT，启动很快 |
| **Hermes**         | React Native                                 | 优先启动时间与内存，AOT 编译   |

引擎的职责是：读源码 → 生成语法树 → 执行 → 回收无用内存（GC）。它既不能打开文件，也不能等待 HTTP。

## 运行时（把引擎接到世界的部分）

| 运行时                 | 引擎           | 如何构建世界                                                           |
| ---------------------- | -------------- | ---------------------------------------------------------------------- |
| **Node.js**            | V8             | libuv + 操作系统系统调用。`fs`、`net`、`process`                       |
| **Bun**                | JavaScriptCore | Zig 编写。`Bun.serve`、`Bun.file`                                      |
| **Deno**               | V8             | Rust 编写。权限模型（`--allow-net` 等）。**2025 年被 Cloudflare 收购** |
| **Cloudflare Workers** | V8 isolate     | 边缘上的 isolate。`fetch` 等 Web 标准 + 绑定                           |

没有 `process`，没有 `require`，却有 `fetch` 和 `crypto`——这就是 Workers。**isolate** 既不是进程也不是容器，而是可以在一批进程里塞进很多的 V8 执行单元，启动只要几毫秒。

执行下面的代码，就能看到这个 Worker 有什么、没有什么。

```js
typeof process; // undefined
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined
typeof caches; // object（Workers 的 Cache API）
```
