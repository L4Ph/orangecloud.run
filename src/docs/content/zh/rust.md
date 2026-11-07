# Rust 与 WebAssembly（workers-rs）

在加密算法实现、复杂二进制协议解析器、直接操作图像像素等计算密集型任务中，依赖 V8 JIT 编译的 JavaScript 会面临垃圾回收（GC）停机时间和内存开销的瓶颈。

Cloudflare Workers 提供了 **WebAssembly（Wasm）** 的一线支持。通过使用官方的 `workers-rs` crate，可以将类型安全性和内存安全性极高的 Rust 代码编译为 Wasm 字节码，并在 isolate 内部以接近原生的速度运行。

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
worker = "0.7"
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
# 安装构建工具
cargo install worker-build

# 生成 Wasm 二进制文件和 JS 调用代码
worker-build --release

# 部署至边缘网络
cf deploy
```

`worker-build` 通过 Rust 编译器（`rustc`）构建 `wasm32-unknown-unknown` 目标的二进制文件，并将起到 V8 边界作用的 JavaScript 包装器（源自 `wasm-bindgen` 的 shim）输出到 `build/worker/shim.mjs` 中。配置文件的 `worker.entrypoint` 属性指定了该 shim 文件。

## 与 JavaScript 的分工界限

- **Rust / Wasm 占据绝对优势的领域**：CPU 绑定的高负载运算处理（数据压缩、分词器、加密处理、几何计算），以及希望直接复用 C/C++ 或 Rust 成熟 crate 生态系统的场景。
- **JavaScript 占据优势的领域**：主要处理为获取外部 Web API 或等待 D1/KV 数据的 I/O 绑定任务。由于 Wasm 二进制文件的展开成本以及跨界限（FFI）的开销，在纯 I/O 流水线中，JavaScript 的初始化速度更快且占用空间更小。
