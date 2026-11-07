# Containers（コンテナ実行環境）

V8 isolate はミリ秒で立ち上がり、大量のリクエストを軽快に捌く。だが、FFmpeg で動画をトランスコードしたいとき、あるいは C 言語で書かれた巨大なバイナリを実行したいとき、isolate の壁に行く手を阻まれる。OS のカーネル機能も、任意ファイルの実行権限も、そこには存在しないからだ。

Cloudflare Containers は、isolate でどうしても解決できない課題に対する**最後の手段**である。独自の Docker イメージをそのままエッジへデプロイし、Durable Objects の背後で完全な Linux コンテナを必要に応じて起動・停止する。

## isolate とコンテナのトレードオフ

| 比較項目         | V8 isolate（Workers）        | Cloudflare Containers                                               |
| ---------------- | ---------------------------- | ------------------------------------------------------------------- |
| 起動時間         | ミリ秒単位（即座に応答開始） | 数秒オーダー（コンテナの起動待ち）                                  |
| メモリ上限       | 128MB（軽量設計）            | 256 MiB 〜 12 GiB（インスタンスタイプで選ぶ）                       |
| 実行可能ファイル | JS、TS、Wasm、Pyodide        | 任意の Linux 実行ファイル、共有ライブラリ                           |
| 課金単位         | 実行 CPU 時間とリクエスト数  | 稼働中の 10 ms ごと（メモリ・ディスクは割り当て量、CPU は実使用分） |

Web API のリクエストを仲介するだけであれば、isolate の方が起動が速く、リソース効率も優れている。**まず Workers 単体で実現できないかを徹底的に考え、どうしても不可能な場合にのみコンテナを導入する**というのがエッジ設計の鉄則である。

## Durable Object によるコンテナ制御

コードからコンテナを操作する場合は、Durable Object の `this.ctx.container` を使う。Durable Object が `start()` でコンテナを起動し、`exec()` でコマンドを実行し、`getTcpPort()` でポートへ接続する。`@cloudflare/sandbox`（1.0 以降）は `Files` などの補助クラスだけを提供する。

```ts
import { DurableObject } from "cloudflare:workers";

// cloudflare.config.ts の defineContainer で、schedulingPolicy を "durable-object" にし、
// images.default に Dockerfile を宣言しておく
export class Sandbox extends DurableObject {
  async nodeVersion() {
    const container = this.ctx.container;
    if (!container) throw new Error("コンテナが設定されていない");

    if (!container.running) {
      container.start({
        image: container.images.default,
        entrypoint: ["sleep", "infinity"], // メインプロセスが終わるとコンテナも止まる
        enableInternet: false,
      });
    }
    await container.setInactivityTimeout(10 * 60 * 1000);

    // コンテナ内部でコマンドを実行し、標準出力を受け取る
    const process = await container.exec(["node", "--version"]);
    const { stdout } = await process.output();
    return new TextDecoder().decode(stdout).trim();
  }
}

export default {
  async fetch(request: Request, env: { SANDBOX: DurableObjectNamespace<Sandbox> }) {
    // ユーザー ID やセッションごとに独立したサンドボックスを確保
    const sandbox = env.SANDBOX.getByName("user-session-123");
    return new Response(`Container Node.js: ${await sandbox.nodeVersion()}`);
  },
};
```

コンテナは、Durable Object が非アクティブになってから `setInactivityTimeout()` で指定した時間（最大 6 時間）が過ぎると停止する。稼働中はアイドルでもメモリとディスクが課金され、停止するとディスクの内容は消える。Containers は Workers Paid プランで使える。
