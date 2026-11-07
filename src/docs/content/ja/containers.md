# Containers（エッジコンテナ）

V8 isolate の制約は意図されたものである。永続的なファイルシステムを持たせず、常駐プロセスを禁止し、メモリを 128MB に絞ることで、ミリ秒単位の起動と高い並行性を手に入れた。しかし、現実のワークロードには isolate の境界線を超えてしまう処理が確実に存在する。

FFmpeg による動画エンコード、C/C++ で書かれた既存バイナリの実行、あるいは数ギガバイトのメモリを要する重厚なデータ処理。これらは OS のプロセスとファイルシステムを前提にする。ヘッドレスブラウザの制御だけなら、Workers から Playwright で操作できる Browser Run がある。

Cloudflare Containers は、そうした局面に対する**最後の手段**である。標準的な Docker イメージをエッジ環境へ持ち込み、Durable Objects のライフサイクル制御と結びつけることで、完全な Linux コンテナをオンデマンドで稼働させる。

## アーキテクチャの対比

| 評価軸         | V8 isolate（Workers）            | Cloudflare Containers                           |
| -------------- | -------------------------------- | ----------------------------------------------- |
| 起動レイテンシ | ミリ秒単位                       | 1〜3 秒前後（イメージの大きさや起動処理による） |
| メモリ割り当て | 128MB（上限）                    | 256 MiB 〜 12 GiB（インスタンスタイプで選ぶ）   |
| ランタイム環境 | Web 標準 API、Wasm、Pyodide      | 完全な Linux（Debian、Alpine、Ubuntu 等）       |
| 最適な領域     | API ルーティング、認証、軽量変換 | 重厚なバッチ、メディア変換、サンドボックス実行  |

「HTTP リクエストを受信してデータベースを叩く」といった典型的な処理であれば、isolate の方が起動が速く、リソース効率も優れている。**あらゆる手段を Workers 単体で模索し、OS ネイティブのバイナリや大量メモリが不可欠であると判明したときに初めてコンテナを採用する**のが、エッジ設計において破綻を避ける原則である。

## Durable Object によるライフサイクル制御

コンテナは Durable Object の `this.ctx.container` から操作する。Worker は名前で Durable Object を呼び出し、Durable Object が `start()` で起動し、`exec()` でコマンドを実行し、`setInactivityTimeout()` で停止までの時間を決める。`@cloudflare/sandbox`（1.0 以降）が提供するのは `Files` などの補助クラスだけで、コンテナの起動・停止・監視は行わない。ここで使う `durable_object` スケジューリングポリシーは公開ベータで、従来の `default` ポリシーは非推奨である。

```ts
import { DurableObject } from "cloudflare:workers";

// cloudflare.config.ts の defineContainer で、schedulingPolicy を "durable-object" にし、
// images.default に Dockerfile を宣言しておく
export class Sandbox extends DurableObject {
  async run(argv: string[]) {
    const container = this.ctx.container;
    if (!container) throw new Error("コンテナが設定されていない");

    if (!container.running) {
      // start() は準備完了を待たずに戻る。exec() は起動中のコンテナを待つ
      container.start({
        image: container.images.default,
        instance: "lite", // 1/16 vCPU・メモリ 256 MiB
        entrypoint: ["sleep", "infinity"], // メインプロセスが終わるとコンテナも止まる
        enableInternet: false, // 外向きの通信を許可しない
      });
    }
    // Durable Object が非アクティブになってから 10 分で停止する（最大 6 時間）
    await container.setInactivityTimeout(10 * 60 * 1000);

    // exec() はシェルを介さず、引数の配列をそのまま実行する
    const process = await container.exec(argv);
    const { exitCode, stdout } = await process.output();
    return { exitCode, stdout: new TextDecoder().decode(stdout) };
  }
}

export default {
  async fetch(request: Request, env: { SANDBOX: DurableObjectNamespace<Sandbox> }) {
    // セッションごとに別の Durable Object（別のコンテナ）を使う
    const sandbox = env.SANDBOX.getByName("session-456");
    const { stdout } = await sandbox.run(["node", "--version"]);
    return new Response(stdout);
  },
};
```

コンテナは、Durable Object が非アクティブになってから `setInactivityTimeout()` で指定した時間（最大 6 時間）が過ぎると停止する。指定しない場合は、非アクティブになった直後に止まる。課金は 10 ms 単位で、稼働中はアイドルでもメモリとディスクが割り当て量のまま、CPU は実際に使った分だけ課金される。停止すると課金は止まるが、ディスクの内容は消える。Containers は Workers Paid プランで使える。
