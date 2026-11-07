# Rust and WebAssembly (workers-rs)

For compute-intensive tasks—such as implementing cryptographic algorithms, parsing complex binary protocols, or directly manipulating image pixels—JavaScript relying on V8's JIT compilation faces hurdles in garbage collection (GC) stall times and memory overhead.

Cloudflare Workers provides first-class support for **WebAssembly (Wasm)**. Using the official `workers-rs` crate, you can compile Rust code—with extreme type and memory safety—into Wasm bytecode and execute it at near-native speeds within an isolate.

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
worker = "0.7"
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
# Install the build tool
cargo install worker-build

# Generate Wasm binary and JS glue code
worker-build --release

# Deploy to the edge network
npx wrangler deploy
```

`worker-build` builds a binary for the `wasm32-unknown-unknown` target via the Rust compiler (`rustc`) and outputs a JavaScript wrapper (a shim derived from `wasm-bindgen`) that acts as a boundary with V8 to `build/worker/shim.mjs`. The `main` property in the configuration file specifies this shim file.

## Boundary for Separation from JavaScript

- **Areas where Rust / Wasm have an overwhelming advantage**: CPU-bound, heavy-duty computational processing (data compression, tokenizers, cryptographic processing, geometric calculations), and scenarios where you want to reuse the mature crate ecosystems of C/C++ or Rust as-is.
- **Areas where JavaScript is advantageous**: I/O-bound tasks where the primary processing involves fetching external Web APIs or waiting for data retrieval from D1/KV. Due to the deployment costs and boundary-crossing (FFI) overhead of Wasm binaries, JavaScript offers faster initialization and a smaller footprint for pure I/O pipelines.
