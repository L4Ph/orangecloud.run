# Queues와 Workflows

둘 다 "그 자리에서 끝내지 않는 일"을 다룹니다. 차이는 **입자의 크기**입니다.

## Queues (비동기 메시지)

- Worker가 메시지를 `send()`, 다른 Worker(컨슈머)가 묶어서 처리
- 실패하면 자동 재시도, 그래도 안 되면 Dead Letter Queue로
- 메시지 하나 64KB까지, 기본 보존 4일(최대 14일)
- 어울림: 메일 발송, 이미지 변환, Webhook 재전송, 로그 후처리

```js
// 보내는 쪽
await env.QUEUE_EMAILS.send({ to: 'a@example.com', template: 'welcome' });

// 받는 쪽 (queues/emails.ts)
export const queue = defineQueue(async (batch) => {
  for (const message of batch.messages) {
    await sendEmail(message.body);
  }
});
```

과금은 메시지 수 × 작업 수(대략 메시지당 3회). 무료 한도는 하루 1만 작업입니다.

## Workflows (긴 흐름)

- 단계를 순서대로 실행하고 **중간에 실패해도 이어서 재개**합니다
- `step.sleep('3 days')` 같은 대기가 가능하며 과금되지 않습니다
- 어울림: 청구 마감 처리, 가입 후 단계적 메일, 몇 분에서 며칠 걸리는 작업

```js
export class Onboarding extends WorkflowEntrypoint {
  async run(event, step) {
    const user = await step.do('create user', async () => createUser(event.payload));
    await step.sleep('wait a day', '1 day');
    await step.do('send tips', async () => sendTips(user));
  }
}
```

## 선택 기준

| 하고 싶은 일 | 선택 |
| --- | --- |
| 바로 응답하고 뒤에서 한 번 처리 | Queues |
| 순서, 재개, 대기가 필요 | Workflows |
| 몇 초 안에 끝나는 단발 작업 | `ctx.waitUntil()` |
| 동시 실행을 하나로 제한 | Durable Objects |

이 장은 자료만 제공합니다(공유 샌드박스에서는 큐를 안전하게 돌릴 수 없음). 배포 후 자신의 계정에서 시험해 보세요.
