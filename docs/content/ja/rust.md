# Rust と WebAssembly（workers-rs）

暗号アルゴリズムの実装、複雑なバイナリプロトコルのパーサー、画像ピクセルの直接操作など、計算集約型のタスクにおいて、V8 の JIT コンパイルに頼った JavaScript はガベージコレクション（GC）の停止時間やメモリオーバーヘッドの壁に直面する。

Cloudflare Workers は、**WebAssembly（Wasm）** の第一級サポートを備えている。公式の `workers-rs` クレートを用いることで、型安全性とメモリ安全性を極限まで高めた Rust コードを Wasm バイトコードへコンパイルし、isolate 内部でネイティブに近い速度で実行できる。

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
worker = "0.7"
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
# ビルドツールの導入
cargo install worker-build

# Wasm バイナリと JS グルーコードの生成
worker-build --release

# エッジネットワークへのデプロイ
cf deploy
```

`worker-build` は Rust コンパイラ（`rustc`）を介して `wasm32-unknown-unknown` ターゲットのバイナリをビルドし、V8 との境界を取り持つ JavaScript ラッパー（`wasm-bindgen` 由来のシム）を `build/worker/shim.mjs` へ出力する。設定ファイルの `worker.entrypoint` プロパティはこのシムファイルを指定する。

## JavaScript との棲み分けの境界線

- **Rust / Wasm が圧倒的に優位な領域**: CPU バウンドの重厚な演算処理（データ圧縮、トークナイザー、暗号処理、幾何計算）、C/C++ や Rust の成熟したクレートエコシステムをそのまま再利用したい局面。
- **JavaScript が有利な領域**: 主な処理が外部 Web API のフェッチや D1/KV からのデータ取得待ちである I/O バウンドなタスク。Wasm バイナリの展開コストや境界越え（FFI）のオーバーヘッドが存在するため、純粋な I/O パイプラインでは JavaScript の方が初期化が速くフットプリントも小さく収まる。
