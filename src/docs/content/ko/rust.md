# Rust와 WebAssembly(workers-rs)

복잡한 바이너리 프로토콜 파서, 이미지 픽셀의 직접 조작 등 계산 집약적인 작업에서는 Rust를 WebAssembly로 컴파일해 사용하는 선택지가 있다.

Workers는 JavaScript, TypeScript, Python과 함께 Rust를 최상급(first-class) 지원 언어로 꼽는다. 공식 `workers-rs` 크레이트를 사용하면 Rust 코드를 **WebAssembly(Wasm)** 바이트코드로 컴파일하여 isolate 내부에서 실행할 수 있다.

## 최소한의 구성

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
    Response::ok("Rust와 WebAssembly를 이용한 빠른 응답")
}
```

## 빌드 및 에지 배포 연쇄

Rust 소스 코드를 Workers 실행 바이너리로 변환하려면 공식 도구인 `worker-build`를 사용한다.

```sh
# Wasm 타겟 추가(최초 1회)
rustup target add wasm32-unknown-unknown

# 빌드 도구 설치
cargo install worker-build

# Wasm 바이너리와 JS 글루 코드 생성
worker-build --release

# 에지 네트워크에 배포
npx wrangler deploy
```

`worker-build`는 Rust 컴파일러(`rustc`)를 통해 `wasm32-unknown-unknown` 타겟의 바이너리를 빌드하고, `wasm-bindgen`의 글루 코드를 esbuild로 묶은 `build/index.js`와 Wasm 바이너리인 `build/index_bg.wasm`을 출력한다. `build/worker/shim.mjs`는 예전 이름과의 호환용으로, `index.js`를 다시 export할 뿐이다.

Rust Worker는 공식 절차에서 Wrangler로 배포한다. `wrangler.toml`의 `main`에 `build/index.js`를 지정하고 `[build] command`에서 `worker-build`를 호출한다. cf beta.28의 `cf deploy`는 위의 `Cargo.toml` 그대로는 "No Cloudflare dev server is installed"라는 메시지와 함께 멈춘다.

## JavaScript와의 영역 구분 경계

- **Rust / Wasm이 적합한 영역**: CPU 바운드의 무거운 연산 처리(데이터 압축, 토큰나이저, 기하 계산), 그리고 `wasm32-unknown-unknown`으로 컴파일할 수 있는 Rust 크레이트를 그대로 사용하고 싶은 상황. Tokio나 async_std 같은 런타임은 사용할 수 없다.
- **JavaScript가 유리한 영역**: 주요 처리가 외부 Web API 페치나 D1/KV로부터의 데이터 취득 대기인 I/O 바운드 작업. Wasm을 사용하는 Worker는 동등한 JavaScript Worker보다 커지기 쉽고, 클수록 시작하는 데 시간이 걸린다. Worker 크기는 압축 전 크기 기준 64 MiB까지, 시작은 1초 이내라는 상한도 있다. 순수 I/O 처리에서는 JavaScript가 크기가 더 작고 시작도 빠른 편이다.
