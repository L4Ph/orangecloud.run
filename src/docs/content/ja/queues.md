# 非同期処理の設計（Queues と Workflows）

HTTP リクエストを受信したその場で、メールの送信や画像のサムネイル生成、外部 Webhook の呼び出しまで完了させようとすると、システムはたちまち脆弱になる。外部サービスの遅延がクライアントへのレスポンスをブロックし、タイムアウトやコネクション枯渇を引き起こすからだ。

非同期処理の基盤として Cloudflare は **Queues** と **Workflows** という 2 つの道具を提供する。両者の違いは、扱う処理の**粒度**と**耐久性（状態の保持能力）**にある。

## Queues（非同期メッセージキュー）

Queues は、短時間で完了する単発のバックグラウンドタスクを安全に切り離すための仕組みである。プロデューサー（Worker）がメッセージをキューへ投入し、コンシューマー（`queue` ハンドラを持つ Worker。プロデューサーと同じ Worker でもよい）がそれらをバッチ単位で非同期に消化する。HTTP で取り出すプルコンシューマーも使える。

```js
// プロデューサー側（fetch ハンドラ内）: 即座にメッセージを積んで HTTP レスポンスを返す
await env.EMAIL_QUEUE.send({
  to: "user@example.com",
  template: "welcome_v1",
  payload: { name: "Alice" },
});

// コンシューマー側: バックグラウンドでまとめて処理
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await deliverEmail(message.body);
        message.ack(); // 正常完了を通知
      } catch (err) {
        message.retry(); // 失敗を伝えて再配信させる（max_retries まで）
      }
    }
  },
};
```

- メッセージの最大サイズは 128 KB。キュー内の保持期間は Workers Paid で既定 4 日間（最大 14 日間）、Workers Free では 24 時間で固定。
- 配信は at-least-once で、同じメッセージが複数回届くことがある。順序も保証されない。コンシューマーの処理は冪等にする。
- コンシューマー側で例外が送出されると、バッチ全体が再配信される（`ack()` 済みのメッセージを除く）。再試行は `max_retries`（既定 3 回）までで、上限を超えたメッセージは、デッドレターキュー（DLQ）を設定していれば DLQ へ退避され、設定していなければ削除される。
- 最適な用途: トランザクションメール送信、ログ集計のバッチ処理、外部 Webhook への非同期ディスパッチ。

## Workflows（耐久性を持つ長時間オーケストレーション）

数分から数日間にわたり、複数のステップを順番に実行し、途中でサーバーが再起動しても正確に直前のステップから再開（Durable Execution）させたい場合、Queues ではなく Workflows を採用する。

```ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

export class UserOnboardingWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent<{ email: string }>, step: WorkflowStep) {
    // ステップ 1: 外部決済アカウントの作成
    const account = await step.do("create-billing-account", async () => {
      return await createStripeCustomer(event.payload.email);
    });

    // ステップ 2: 3 日間の待機（CPU 時間は消費しないが、sleep も 1 ステップで、保存した状態は課金対象）
    await step.sleep("wait-trial-period", "3 days");

    // ステップ 3: フォローアップ通知の送出
    await step.do("send-checkin-notification", async () => {
      await sendFollowUpEmail(account.id);
    });
  }
}
```

各ステップの実行結果はインフラ層にチェックポイントとして保存される（1 ステップあたり 1 MiB まで）。途中でプロセスが強制終了されても、完了済みのステップは再実行されず、未完了のステップから再開される。ただし実行中だったステップは再試行されることがあり、ステップの外に書いた処理は重複しうる。メール送信のような副作用のある処理は、ステップの中に置き、冪等にする。

## アーキテクチャ選定の判断基準

| 要件                                                    | 採用すべき機構                                             |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| 応答を返してから 30 秒以内に終わる単発の非同期タスク    | `ctx.waitUntil()`（同一 isolate 内でバックグラウンド実行） |
| 大量のタスクを平滑化し、バッチで非同期処理したい        | **Queues**                                                 |
| 待機期間（`sleep`）や多段階の順序依存がある長時間処理   | **Workflows**                                              |
| 同一リソースに対する並行書き込みを 1 箇所で直列化したい | **Durable Objects**                                        |
