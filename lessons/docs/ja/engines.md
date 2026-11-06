# JavaScript エンジンとランタイム

コードは魔法では動きません。**エンジン**が構文を解析して実行し、**ランタイム**がそのエンジンに「外の世界」を繋ぎます。この2つを分けて考えると、Cloudflare Workers の立ち位置が一気に見えます。

## エンジン（JavaScript を実行する部分）

| エンジン           | 主な利用先                                   | 特徴                                 |
| ------------------ | -------------------------------------------- | ------------------------------------ |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | JIT つき。最速級だがバイナリは大きい |
| **SpiderMonkey**   | Firefox（Gecko）                             | 最初期からある実装。JIT（Ion）つき   |
| **JavaScriptCore** | Safari（WebKit）/ Bun                        | Apple 製。JIT つきで軽量             |
| **QuickJS**        | 組み込み・小さい環境                         | 数百 KB 級。JIT なしで起動が速い     |
| **Hermes**         | React Native                                 | 起動時間とメモリ優先。AOT コンパイル |

エンジンの仕事は、ソースを読む → 構文木にする → 実行する → 不要なメモリを回収する（GC）、まで。ファイルを開くことも、HTTP を待つこともできません。

## ランタイム（エンジンに世界を繋ぐ部分）

| ランタイム             | エンジン       | 外の世界の作り                                                             |
| ---------------------- | -------------- | -------------------------------------------------------------------------- |
| **Node.js**            | V8             | libuv + OS のシステムコール。`fs`、`net`、`process`                        |
| **Bun**                | JavaScriptCore | Zig 製。`Bun.serve`、`Bun.file`                                            |
| **Deno**               | V8             | Rust 製。権限モデル（`--allow-net` など）。**2025 年に Cloudflare が買収** |
| **Cloudflare Workers** | V8 isolate     | エッジ上の isolate。`fetch` などの Web 標準 + バインディング               |

`process` も `require` も無いのに `fetch` と `crypto` はある——それが Workers です。**isolate** はプロセスでもコンテナでもなく、1 プロセスの中に大量に詰められる V8 の実行単位で、起動は数ミリ秒です。

下のコードを実行すると、この Worker に何があって何が無いかがそのまま出ます。

```js
typeof process; // undefined
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined
typeof caches; // object（Workers の Cache API）
```
