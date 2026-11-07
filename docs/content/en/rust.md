# Rust (workers-rs)

Workers is not limited to JavaScript and Python. You can **compile Rust to WebAssembly** and run it. The official `worker` crate (workers-rs) lets you write `fetch` handlers in Rust.

## The smallest Worker

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

## Building and deploying

```sh
cargo install worker-build
worker-build --release        # emits build/worker/shim.mjs plus the wasm
npx wrangler deploy
```

Point `main` in `wrangler.jsonc` at the generated `build/worker/shim.mjs`. `worker-build` bundles the wasm with the JavaScript glue that wasm-bindgen produces.

## Why this site's editor cannot run it

Rust **must be compiled**. There is no Rust toolchain inside Workers to compile what you type in a browser, and this editor executes source as-is, so Rust is out of scope.

Wasm itself is fine in Dynamic Workers (a module can be `{ wasm: ArrayBuffer }`), but you pass a **prebuilt** wasm, not source.

## When to use it

- Compute-heavy work (parsers, image processing, crypto)
- Reusing existing Rust crates
- When wasm size and startup are acceptable

If you are only waiting on HTTP or querying a database, JavaScript is smaller and faster. If you truly need Rust, you can also compile it inside a container with `rustc` (expect tens of seconds per build).
