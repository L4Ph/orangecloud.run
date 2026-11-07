# Containers（コンテナ実行環境）

V8 isolate はミリ秒で立ち上がり、数千のリクエストを軽快に捌く。だが、FFmpeg で動画をトランスコードしたいとき、Playwright でヘッドレスブラウザを駆動したいとき、あるいは C 言語で書かれた巨大なバイナリを実行したいとき、isolate の壁に行く手を阻まれる。OS のカーネル機能も、任意ファイルの実行権限も、そこには存在しないからだ。

Cloudflare Containers は、isolate でどうしても解決できない課題に対する**最後の手段**である。独自の Docker イメージをそのままエッジへデプロイし、Durable Objects の背後で完全な Linux コンテナを必要に応じて起動・停止する。

## isolate とコンテナのトレードオフ

| 比較項目         | V8 isolate（Dynamic Workers） | Cloudflare Containers                     |
| ---------------- | ----------------------------- | ----------------------------------------- |
| 起動時間         | 数ミリ秒（即座に応答開始）    | 数秒オーダー（コンテナの起動待ち）        |
| メモリ上限       | 128MB 〜（軽量設計）          | ギガバイト単位で確保可能                  |
| 実行可能ファイル | JS、TS、Wasm、Pyodide         | 任意の Linux 実行ファイル、共有ライブラリ |
| 課金単位         | 実行 CPU 時間                 | コンテナの起動時間（vCPU 分・GiB 時間）   |

Web API のリクエストを仲介するだけであれば、isolate の方が圧倒的に高速で、かつ費用も安く済む。**まず Workers 単体で実現できないかを徹底的に考え、どうしても不可能な場合にのみコンテナを導入する**というのがエッジ設計の鉄則である。

## Sandbox SDK によるコンテナ制御

コードからコンテナを操作する場合は、Cloudflare の Sandbox SDK（`@cloudflare/sandbox`）を利用する。Worker の内部からオンデマンドでコンテナインスタンスを呼び出し、シェルコマンドの実行やポートの公開を行える。

```ts
import { getSandbox } from "@cloudflare/sandbox";

// ユーザー ID やセッションごとに独立したサンドボックスを確保
const sandbox = await getSandbox(env.SANDBOX, "user-session-123");

// コンテナ内部でコマンドを実行し、標準出力を受け取る
const result = await sandbox.run("node --version");
console.log("Container Node.js:", result.stdout);
```

コンテナはリクエストが途絶えると自動的にスリープ状態へ移行し、アクティブに利用されている時間だけが課金対象となる。
