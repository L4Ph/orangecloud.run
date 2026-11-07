# Rust（workers-rs）

Workers は JavaScript と Python だけの場所ではありません。**Rust を WebAssembly にコンパイル**して動かせます。公式の `worker` クレート（workers-rs）を使うと、`fetch` ハンドラを Rust で書けます。

## 最小の Worker

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

## ビルドとデプロイ

```sh
cargo install worker-build
worker-build --release        # build/worker/shim.mjs と wasm を生成
npx wrangler deploy
```

`wrangler.jsonc` の `main` は生成物の `build/worker/shim.mjs` を指します。`worker-build` が wasm と JavaScript の糊（wasm-bindgen の生成物）をまとめてくれます。

## なぜこのサイトのエディタでは動かせないか

Rust は**ビルドが必須**です。ブラウザで書いた Rust をその場でコンパイルする Rust ツールチェーンは Workers の中にありません。このサイトのエディタは「送られたソースをそのまま実行する」ので、Rust は対象外です。

Wasm 自体は Dynamic Workers でも扱えます（`modules` に `{ wasm: ArrayBuffer }` を渡せる）。ただし渡せるのは**ビルド済みの wasm** で、ソースからビルドするわけではありません。

## どこで使うか

- 計算が重い処理（パーサ、画像処理、暗号）
- 既存の Rust クレートを使いたい
- wasm のサイズと起動を許容できる

逆に、HTTP を待つだけ、DB を引くだけなら JavaScript の方が小さくて速いです。Rust が本当に必要なときは、Containers で `rustc` を動かしてビルドする手もあります（ビルドに数十秒かかります）。
