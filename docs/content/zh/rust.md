# Rust（workers-rs）

Workers 不只支持 JavaScript 和 Python。你还可以把 **Rust 编译成 WebAssembly** 运行。官方 `worker` クレート（workers-rs）让你用 Rust 写 `fetch` 处理函数。

## 最小的 Worker

```toml
# Cargo.toml
[package]
name = "rust-worker"
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
    Response::ok("hello from rust")
}
```

## 构建与部署

```sh
cargo install worker-build
worker-build --release        # 生成 build/worker/shim.mjs 和 wasm
npx wrangler deploy
```

`wrangler.jsonc` 的 `main` 指向生成的 `build/worker/shim.mjs`。`worker-build` 会把 wasm 和 wasm-bindgen 生成的 JavaScript 胶水一起打包。

## 为什么本站编辑器无法运行

Rust **必须编译**。Workers 里没有能在浏览器端即时编译 Rust 的工具链，而本站编辑器是“原样执行送来的源码”，所以 Rust 不在范围内。

Wasm 本身在 Dynamic Workers 里可用（模块可以是 `{ wasm: ArrayBuffer }`），但传的是**已构建的 wasm**，不是源码。

## 什么时候用

- 计算密集的処理（解析器、图像处理、加密）
- 想复用现有 Rust crate
- 能接受 wasm 的体积和启动时间

如果只是等 HTTP 或查数据库，JavaScript 更小更快。确实需要 Rust 时，也可以在容器里用 `rustc` 构建（每次构建要几十秒）。
