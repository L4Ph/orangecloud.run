# Queues と Workflows

どちらも「その場で終わらせない仕事」を扱います。違いは**粒度**です。

## Queues（非同期のメッセージ）

- Worker がメッセージを `send()`、別の Worker（コンシューマ）がまとめて処理
- 失敗したら自動リトライ、それでも駄目なら Dead Letter Queue へ
- 1 メッセージ 64KB まで、保持は既定 4 日（最大 14 日）
- 向くもの：メール送信、画像変換、Webhook の再送、ログの後処理

```js
// 送る側
await env.QUEUE_EMAILS.send({ to: 'a@example.com', template: 'welcome' });

// 受ける側（queues/emails.ts）
export const queue = defineQueue(async (batch) => {
  for (const message of batch.messages) {
    await sendEmail(message.body);
  }
});
```

課金はメッセージ数 × 操作（だいたい 1 通＝3 操作）。無料枠は 1 日 1 万操作。

## Workflows（長時間の段取り）

- ステップを順に実行し、**途中で落ちても続きから再開**する
- `step.sleep('3 days')` のような待機ができる（課金されない）
- 向くもの：請求書の締め処理、サインアップ後の段階的なメール、数分〜数日かかる処理

```js
export class Onboarding extends WorkflowEntrypoint {
  async run(event, step) {
    const user = await step.do('create user', async () => createUser(event.payload));
    await step.sleep('wait a day', '1 day');
    await step.do('send tips', async () => sendTips(user));
  }
}
```

## 選び方

| やりたいこと              | 選ぶ              |
| ------------------------- | ----------------- |
| すぐ返して裏で 1 回処理   | Queues            |
| 順番・再開・待機がある    | Workflows         |
| 数秒で終わる単発          | `ctx.waitUntil()` |
| 同時実行を 1 つに絞りたい | Durable Objects   |

この単元は資料のみです（共有サンドボックスではキューを安全に流せないため）。デプロイ後に自分のアカウントで試してください。
