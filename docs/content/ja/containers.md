# Containers（エッジコンテナ）

V8 isolate の制約は意図されたものである。ファイルシステムを奪い、常駐プロセスを禁止し、メモリを 128MB に絞ることで、ミリ秒単位の起動と数万並行のスケールを手に入れた。しかし、現実のワークロードには isolate の境界線を超えてしまう処理が確実に存在する。

FFmpeg による動画エンコード、Playwright によるヘッドレスブラウザの制御、C/C++ で書かれた既存バイナリの実行、あるいは数ギガバイトのメモリを要する重厚なデータ処理。これらは Linux カーネルの完全な機能なしには動かない。

Cloudflare Containers は、そうした局面に対する**最後の切り札**である。標準的な Docker イメージをエッジ環境へ持ち込み、Durable Objects のライフサイクル制御と結びつけることで、完全な Linux コンテナをオンデマンドで稼働させる。

## アーキテクチャの対比

| 評価軸 | V8 isolate（Workers） | Cloudflare Containers |
| --- | --- | --- |
| 起動レイテンシ | 1 〜 5 ミリ秒 | 数秒オーダー（イメージ展開・起動） |
| メモリ割り当て | 128MB 〜 | 複数 GiB 単位で構成可能 |
| ランタイム環境 | Web 標準 API、Wasm、Pyodide | 完全な Linux（Debian、Alpine、Ubuntu 等） |
| 最適な領域 | API ルーティング、認証、軽量変換 | 重厚なバッチ、メディア変換、サンドボックス実行 |

「HTTP リクエストを受信してデータベースを叩く」といった典型的な処理であれば、isolate の方が圧倒的に俊敏で、リソース効率も優れている。**あらゆる手段を Workers 単体で模索し、OS ネイティブのバイナリや大量メモリが不可欠であると判明したときに初めてコンテナを採用する**のが、エッジ設計において破綻を避ける原則である。

## Sandbox SDK によるライフサイクル制御

コンテナの呼び出しには Cloudflare Sandbox SDK（`@cloudflare/sandbox`）を使用する。Worker 側からプログラムを通じてコンテナインスタンスのライフサイクルを束ね、コマンド実行や内部ポートへのトンネリングを制御する。

```ts
import { getSandbox } from '@cloudflare/sandbox';

// セッション単位で隔離されたサンドボックス環境を特定
const sandbox = await getSandbox(env.SANDBOX, 'session-456');

// 独立した Linux 環境のシェル上でコマンドを実行
const execution = await sandbox.run('python3 -c "print(1 + 1)"');
console.log('stdout:', execution.stdout.trim());
```

コンテナは無通信状態が続くと自動的に停止し、CPU リソースの消費を最小限に抑える。長時間のアイドル状態に対して不要な課金が発生しない構造になっている。
