# Rust와 WebAssembly(workers-rs)

암호 알고리즘 구현, 복잡한 바이너리 프로토콜 파서, 이미지 픽셀의 직접 조작 등 계산 집약적인 작업에서 V8의 JIT 컴파일에 의존하는 JavaScript는 가비지 컬렉션(GC) 정지 시간과 메모리 오버헤드라는 장벽에 부딪힌다.

Cloudflare Workers는 **WebAssembly(Wasm)**에 대한 최상급 지원을 제공한다. 공식 `workers-rs` 크레이트를 사용하면 타입 안전성과 메모리 안전성을 극한까지 높인 Rust 코드를 Wasm 바이트코드로 컴파일하여, isolate 내부에서 네이티브에 가까운 속도로 실행할 수 있다.

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
worker = "0.7"
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
# 빌드 도구 설치
cargo install worker-build

# Wasm 바이너리와 JS 글루 코드 생성
worker-build --release

# 에지 네트워크에 배포
npx wrangler deploy
```

`worker-build`는 Rust 컴파일러(`rustc`)를 통해 `wasm32-unknown-unknown` 타겟의 바이너리를 빌드하고, V8과의 경계를 담당하는 JavaScript 래퍼(`wasm-bindgen`에서 유래한 심)를 `build/worker/shim.mjs`에 출력한다. 설정 파일의 `main` 프로퍼티는 이 심 파일을 지정한다.

## JavaScript와의 영역 구분 경계

- **Rust / Wasm이 압도적으로 우위인 영역**: CPU 바운드의 무거운 연산 처리(데이터 압축, 토큰나이저, 암호 처리, 기하 계산), C/C++나 Rust의 성숙한 크레이트 생태계를 그대로 재사용하고 싶은 상황.
- **JavaScript가 유리한 영역**: 주요 처리가 외부 Web API 페치나 D1/KV로부터의 데이터 취득 대기인 I/O 바운드 작업. Wasm 바이너리의 압축 해제 비용이나 경계 넘기(FFI)의 오버헤드가 존재하므로, 순수 I/O 파이프라인에서는 JavaScript의 초기화가 더 빠르고 풋프린트도 작다.
