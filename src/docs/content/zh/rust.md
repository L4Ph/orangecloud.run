# Rust 与 WebAssembly（workers-rs）

在解析复杂二进制协议、直接操作图像像素等计算密集型任务中，可以选择把 Rust 编译为 WebAssembly 来使用。

Workers 把 Rust 与 JavaScript、TypeScript、Python 一同列为一线（first-class）支持的语言。使用官方的 `workers-rs` crate，可以把 Rust 代码编译为 **WebAssembly（Wasm）** 字节码，并在 isolate 内部运行。

## 最小配置

```toml
# Cargo.toml
[package]
name = "rust-wasm-worker"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
worker = "0.8"
```

```rust
// src/lib.rs
use worker::*;

#[event(fetch)]
async fn fetch(_req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    Response::ok("Rust 与 WebAssembly 实现的快速响应")
}
```

## 构建与边缘部署的链式逻辑

将 Rust 源代码转换为 Workers 可执行二进制文件时，使用官方工具 `worker-build`。

```sh
# 添加 Wasm 目标（仅首次需要）
rustup target add wasm32-unknown-unknown

# 安装构建工具
cargo install worker-build

# 生成 Wasm 二进制文件和 JS 胶水代码
worker-build --release

# 部署至边缘网络
npx wrangler deploy
```

`worker-build` 通过 Rust 编译器（`rustc`）构建 `wasm32-unknown-unknown` 目标的二进制文件，并输出用 esbuild 打包了 `wasm-bindgen` 胶水代码的 `build/index.js`，以及 Wasm 二进制文件 `build/index_bg.wasm`。`build/worker/shim.mjs` 只是为兼容旧名称而保留，仅重新导出 `index.js`。

Rust 的 Worker 按官方流程使用 Wrangler 部署。在 `wrangler.toml` 的 `main` 中指定 `build/index.js`，并在 `[build] command` 中调用 `worker-build`。在 cf beta.28 中，使用上面的 `Cargo.toml` 时，`cf deploy` 会以 "No Cloudflare dev server is installed" 报错而停止。

## 与 JavaScript 的分工界限

- **适合 Rust / Wasm 的领域**：CPU 绑定的高负载运算（数据压缩、分词器、几何计算），以及希望直接使用可编译为 `wasm32-unknown-unknown` 的 Rust crate 的场景。Tokio、async_std 等运行时无法使用。
- **适合 JavaScript 的领域**：主要处理为获取外部 Web API 或等待 D1/KV 数据的 I/O 绑定任务。使用 Wasm 的 Worker 往往比功能相同的 JavaScript Worker 更大，越大启动越慢。此外还有上限：Worker 大小为未压缩 64 MiB，启动须在 1 秒内完成。在纯 I/O 处理中，JavaScript 往往体积更小、启动更快。
