# JavaScript エンジンとランタイム

JavaScript をブラウザの外で動かそうとした瞬間、実行環境は必ず二つの部品に分かれる。ソースコードを解析してバイトコードや機械語として実行する**エンジン**と、そのエンジンにネットワークやタイマーといった外の世界を繋ぐ**ランタイム**である。この境界線を意識しないと、Cloudflare Workers のアーキテクチャは見えてこない。

## エンジン（実行を担う心臓部）

| エンジン           | 主な利用先                                   | 特徴                                                    |
| ------------------ | -------------------------------------------- | ------------------------------------------------------- |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | Google 製。多段の JIT コンパイラを備える                |
| **SpiderMonkey**   | Firefox（Gecko）                             | Mozilla 製。JIT は Baseline と Warp（IonMonkey の後継） |
| **JavaScriptCore** | Safari（WebKit）/ Bun                        | Apple 製。インタプリタと 3 段の JIT で実行する          |
| **QuickJS**        | 組み込み・軽量環境                           | 数百 KB 級。JIT なしで極小・即座に起動                  |
| **Hermes**         | React Native                                 | AOT コンパイル前提。起動時間とメモリを優先              |

エンジンが担うのは、ECMAScript（JavaScript の言語仕様）と WebAssembly の実行である。ソースコードを読み、抽象構文木を組み立て、バイトコードまたは機械語として実行する。`Array` や `Promise` などの組み込みオブジェクトを提供し、不要になったメモリをガベージコレクション（GC）で回収する。ファイルを開く機能も、ネットワークソケットを待ち受ける機能も、ECMAScript の仕様には含まれない。

## ランタイム（世界との接合点）

エンジンに「外の世界」と会話する手段を与えるのがランタイムである。

| ランタイム             | エンジン       | 外の世界へのインターフェース                                                                           |
| ---------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| **Node.js**            | V8             | libuv 経由の OS システムコール。`fs`、`net`、`process`                                                 |
| **Bun**                | JavaScriptCore | Rust 製のネイティブ実装。`Bun.serve`、`Bun.file`。**2025 年 12 月に Anthropic が買収**                 |
| **Deno**               | V8             | Rust 製。細粒度の権限モデル（`--allow-net` 等）。**2026 年 10 月に Cloudflare へ合流**                 |
| **Cloudflare Workers** | V8             | エッジ上の分離環境。ランタイムは OSS の workerd。Web 標準 API（`fetch` 等）+ Cloudflare バインディング |

同じ V8 エンジンを積んでいるのだから、Node.js と Workers は同じように動くはずだ——そう思ってコードを持ち込むと、最初の数行で足元をすくわれる。Workers にはローカルディスクがなく、ES modules 形式の Worker には `require` もない。`process` や `node:fs` は互換層（`nodejs_compat`）が提供するもので、互換日付（compatibility date）が 2026-08-04 以降の Worker では既定で有効になる。ただし `node:fs` の実体は、メモリ上の仮想ファイルシステムである。

Workers の基本になるのは、ブラウザでおなじみの Web 標準（`fetch`、`Request`、`Response`、`crypto`）と、プラットフォーム固有のバインディングである。

Workers を支える **V8 isolate** は、OS のプロセスでも独立したコンテナでもない。単一の OS プロセス内に数百から数千の独立した実行空間を詰め込む。独立したメモリ空間を持ちながら、起動はコンテナや仮想マシン上の Node プロセスより約 100 倍速いと Cloudflare は説明している。

エディタ上のコードを実行すると、グローバル空間の検証結果が出力される。このエディタの Worker は互換日付 2026-02-24、`nodejs_compat` なしで動くため、`process` は存在しない。出力の `navigator = object` は、`navigator.userAgent` が `Cloudflare-Workers` を返すオブジェクトで、実行環境の判別に使える。この環境に何が存在し、何が削ぎ落とされているのかを確かめてほしい。

```js
typeof process; // undefined（Node.js の痕跡はない。nodejs_compat を有効にすると object）
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined（ブラウザの DOM もない）
typeof caches; // object（Cache API。ブラウザ版と違う点がある）
```
