# Containers

Workers（isolate）で足りないときの**最後の手段**。Docker イメージをそのまま動かせます。Cloudflare 側が Durable Object の裏でコンテナを起動・停止します。

## isolate で足りない例

- ネイティブバイナリや重い依存（ffmpeg、Python の科学計算、Playwright）
- 長時間動き続けるプロセス（WebSocket サーバ、ゲームサーバ）
- メモリを 128MB 以上使う処理
- 既存の Docker イメージをそのまま使いたい

逆に「HTTP を待つだけ」「DB を引くだけ」なら isolate の方が速くて安い。**まず Workers で書けないか考える**のが原則です。

## 動かし方の形

```ts
import { getSandbox } from '@cloudflare/sandbox';

const sandbox = await getSandbox(env.SANDBOX, 'user-123');
const result = await sandbox.run('node --version');
```

Cloudflare の Sandbox SDK（`@cloudflare/sandbox`）を使うと、Worker から `getSandbox()` でコンテナを取り、`run` / ファイル操作 / ポート公開ができます。

## 料金と起動

| 項目   | 有料プラン                         |
| ------ | ---------------------------------- |
| メモリ | 25 GiB 時間/月 込み                |
| CPU    | 375 vCPU 分/月 込み                |
| 起動   | 秒オーダー（isolate はミリ秒）     |
| 停止   | 一定時間でスリープ。利用中だけ課金 |

**起動に秒がかかり、使っていなくてもイメージのビルドと配置にコストがかかる**ので、教育用サンドボックスに向くのは isolate（Dynamic Workers）の方です。このサイトもその構成です。

この単元は資料のみです（コンテナのビルドと起動に Docker と Workers 有料プランが必要）。
