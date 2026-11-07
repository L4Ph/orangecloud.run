# 非同期処理の設計（Queues と Workflows）

HTTP リクエストを受信したその場で、メールの送信や画像のサムネイル生成、外部 Webhook の呼び出しまで完了させようとすると、システムはたちまち脆弱になる。外部サービスの遅延がクライアントへのレスポンスをブロックし、タイムアウトやコネクション枯渇を引き起こすからだ。

非同期処理の基盤として Cloudflare は **Queues** と **Workflows** という 2 つの道具を提供する。両者の違いは、扱う処理の**粒度**と**耐久性（状態の保持能力）**にある。

## Queues（非同期メッセージキュー）

Queues は、短時間で完了する単発のバックグラウンドタスクを安全に切り離すための仕組みである。プロデューサー（Worker）がメッセージをキューへ投入し、コンシューマー（別の Worker）がそれらをバッチ単位で非同期に消化する。

```js
// プロデューサー側: 即座にメッセージを積んで HTTP レスポンスを返す
await env.EMAIL_QUEUE.send({
  to: 'user@example.com',
  template: 'welcome_v1',
  payload: { name: 'Alice' },
});

// コンシューマー側: バックグラウンドでまとめて処理
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await deliverEmail(message.body);
        message.ack(); // 正常完了を通知
      } catch (err) {
        message.retry(); // 失敗時は自動再試行
      }
    }
  },
};
```

- メッセージの最大サイズは 64KB、キュー内の最大保持期間は既定で 4 日間（最大 14 日間）。
- コンシューマー側で例外が送出された場合、設定されたポリシーに従って自動再試行が行われ、上限を超えた場合はデッドレターキュー（DLQ）へと退避される。
- 最適な用途: トランザクションメール送信、ログ集計のバッチ処理、外部 Webhook への非同期ディスパッチ。

## Workflows（耐久性を持つ長時間オーケストレーション）

数分から数日間にわたり、複数のステップを順番に実行し、途中でサーバーが再起動しても正確に直前のステップから再開（Durable Execution）させたい場合、Queues ではなく Workflows を採用する。

```ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

export class UserOnboardingWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // ステップ 1: 外部決済アカウントの作成
    const account = await step.do('create-billing-account', async () => {
      return await createStripeCustomer(event.payload.email);
    });

    // ステップ 2: 3 日間の待機（CPU 時間やプロセスは消費されず課金ゼロ）
    await step.sleep('wait-trial-period', '3 days');

    // ステップ 3: フォローアップ通知の送出
    await step.do('send-checkin-notification', async () => {
      await sendFollowUpEmail(account.id);
    });
  }
}
```

各ステップの実行結果はインフラ層にチェックポイントとして保存される。途中でプロセスが強制終了されても、すでに完了したステップが重複実行されることはなく、未完了のステップから厳密に再開される。

## アーキテクチャ選定の判断基準

| 要件 | 採用すべき機構 |
| --- | --- |
| 数秒以内に完了する単発の非同期タスク | `ctx.waitUntil()`（同一 isolate 内でバックグラウンド実行） |
| 大量のタスクを平滑化し、バッチで非同期処理したい | **Queues** |
| 待機期間（`sleep`）や多段階の順序依存がある長時間処理 | **Workflows** |
| 同一リソースに対する並行書き込みを 1 箇所で直列化したい | **Durable Objects** |
