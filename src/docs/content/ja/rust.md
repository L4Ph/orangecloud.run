# Rust と WebAssembly（workers-rs）

複雑なバイナリプロトコルのパーサーや、画像ピクセルの直接操作など、計算集約型のタスクでは、Rust を WebAssembly にコンパイルして使う選択肢がある。

Workers は、JavaScript、TypeScript、Python と並んで Rust を第一級サポートの言語としている。公式の `workers-rs` クレートを使うと、Rust のコードを **WebAssembly（Wasm）** のバイトコードへコンパイルして、isolate の内部で実行できる。

## 最小限の構成

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
    Response::ok("Rust と WebAssembly による高速なレスポンス")
}
```

## ビルドとエッジデプロイの連鎖

Rust ソースコードから Workers 実行バイナリへの変換には、公式ツールである `worker-build` を使用する。

```sh
# Wasm ターゲットの追加（初回のみ）
rustup target add wasm32-unknown-unknown

# ビルドツールの導入
cargo install worker-build

# Wasm バイナリと JS グルーコードの生成
worker-build --release

# エッジネットワークへのデプロイ
npx wrangler deploy
```

`worker-build` は Rust コンパイラ（`rustc`）を介して `wasm32-unknown-unknown` ターゲットのバイナリをビルドし、`wasm-bindgen` のグルーコードを esbuild でまとめた `build/index.js` と、Wasm バイナリの `build/index_bg.wasm` を出力する。`build/worker/shim.mjs` は旧名との互換用で、`index.js` を再エクスポートするだけである。

Rust の Worker は、公式の手順では Wrangler でデプロイする。`wrangler.toml` の `main` に `build/index.js` を指定し、`[build] command` で `worker-build` を呼ぶ。cf beta.28 の `cf deploy` は、上の `Cargo.toml` のままでは "No Cloudflare dev server is installed" で止まる。

## JavaScript との棲み分けの境界線

- **Rust / Wasm が向く領域**: CPU バウンドの重い演算処理（データ圧縮、トークナイザー、幾何計算）や、`wasm32-unknown-unknown` にコンパイルできる Rust のクレートをそのまま使いたい局面。Tokio や async_std のランタイムは使えない。
- **JavaScript が有利な領域**: 主な処理が外部 Web API のフェッチや D1/KV からのデータ取得待ちである I/O バウンドなタスク。Wasm を使う Worker は、同等の JavaScript の Worker より大きくなりやすく、大きいほど起動に時間がかかる。Worker のサイズは非圧縮で 64 MiB まで、起動は 1 秒以内という上限もある。純粋な I/O の処理では、JavaScript の方がサイズが小さく、起動も速くなりやすい。
