# Rust and WebAssembly (workers-rs)

For compute-intensive tasks such as parsing complex binary protocols or directly manipulating image pixels, compiling Rust to WebAssembly is an option.

Workers lists Rust as a first-class supported language, alongside JavaScript, TypeScript, and Python. With the official `workers-rs` crate, you can compile Rust code into **WebAssembly (Wasm)** bytecode and run it inside an isolate.

## Minimal Configuration

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
    Response::ok("Fast response via Rust and WebAssembly")
}
```

## Build and Edge Deployment Chain

To convert Rust source code into a Workers executable binary, use the official `worker-build` tool.

```sh
# Add the Wasm target (first time only)
rustup target add wasm32-unknown-unknown

# Install the build tool
cargo install worker-build

# Generate Wasm binary and JS glue code
worker-build --release

# Deploy to the edge network
npx wrangler deploy
```

`worker-build` builds a binary for the `wasm32-unknown-unknown` target via the Rust compiler (`rustc`) and outputs `build/index.js`, the `wasm-bindgen` glue code bundled with esbuild, and `build/index_bg.wasm`, the Wasm binary. `build/worker/shim.mjs` exists only for compatibility with the old name and just re-exports `index.js`.

For a Rust Worker, the official procedure deploys with Wrangler. Set `main` in `wrangler.toml` to `build/index.js`, and call `worker-build` from `[build] command`. In cf beta.28, `cf deploy` stops with "No Cloudflare dev server is installed" for a project with the `Cargo.toml` above.

## Boundary for Separation from JavaScript

- **Areas where Rust / Wasm fit**: CPU-bound, heavy computational processing (data compression, tokenizers, geometric calculations), and scenarios where you want to use Rust crates that compile to `wasm32-unknown-unknown` as they are. Runtimes such as Tokio and async_std cannot be used.
- **Areas where JavaScript is advantageous**: I/O-bound tasks where the primary processing involves fetching external Web APIs or waiting for data retrieval from D1/KV. A Worker that uses Wasm tends to be larger than an equivalent JavaScript Worker, and the larger it is, the longer it takes to start. There are also limits of 64 MiB uncompressed for Worker size and 1 second for startup. For pure I/O processing, JavaScript tends to be smaller and faster to start.
