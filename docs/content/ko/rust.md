# Rust(workers-rs)

Workers는 JavaScript와 Python만의 공간이 아닙니다. **Rust를 WebAssembly로 컴파일**해 실행할 수 있습니다. 공식 `worker` 크레이트(workers-rs)로 `fetch` 핸들러를 Rust로 작성합니다.

## 가장 작은 Worker

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

## 빌드와 배포

```sh
cargo install worker-build
worker-build --release        # build/worker/shim.mjs와 wasm 생성
npx wrangler deploy
```

`wrangler.jsonc`의 `main`은 생성된 `build/worker/shim.mjs`를 가리킵니다. `worker-build`가 wasm과 wasm-bindgen이 만든 JavaScript 글루를 함께 묶습니다.

## 이 사이트의 에디터에서 실행할 수 없는 이유

Rust는 **빌드가 필수**입니다. 브라우저에서 쓴 Rust를 즉시 컴파일하는 툴체인은 Workers 안에 없고, 이 에디터는 받은 소스를 그대로 실행하므로 Rust는 대상이 아닙니다.

Wasm 자체는 Dynamic Workers에서 다룰 수 있습니다(모듈을 `{ wasm: ArrayBuffer }`로 전달). 다만 전달하는 것은 **빌드된 wasm**이며 소스가 아닙니다.

## 언제 쓰나

- 계산이 무거운 작업(파서, 이미지 처리, 암호)
- 기존 Rust 크레이트를 쓰고 싶을 때
- wasm 크기와 기동을 감수할 수 있을 때

HTTP 대기나 DB 조회만 한다면 JavaScript가 더 작고 빠릅니다. 정말 필요하다면 컨테이너에서 `rustc`로 빌드하는 방법도 있습니다(빌드에 수십 초).
