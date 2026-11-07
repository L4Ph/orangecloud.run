# Queues 与 Workflows

两者都处理“不在本次请求里做完的工作”。区别在于**粒度**。

## Queues（异步消息）

- Worker 用 `send()` 发消息，另一个 Worker（消费者）批量处理
- 失败自动重试，仍失败则进入 Dead Letter Queue
- 单条消息最大 64KB，默认保留 4 天（最长 14 天）
- 适合：发邮件、图片转换、Webhook 重试、日志后处理

```js
// 发送侧
await env.QUEUE_EMAILS.send({ to: 'a@example.com', template: 'welcome' });

// 消费侧（queues/emails.ts）
export const queue = defineQueue(async (batch) => {
  for (const message of batch.messages) {
    await sendEmail(message.body);
  }
});
```

计费是消息数乘以操作数（大约每条 3 次操作）。免费额度为每天 1 万次操作。

## Workflows（长时间编排）

- 按顺序执行步骤，**中途失败也能从断点继续**
- `step.sleep('3 days')` 可以等待而不计费
- 适合：结账处理、注册后的分阶段邮件、耗时几分钟到几天的工作

```js
export class Onboarding extends WorkflowEntrypoint {
  async run(event, step) {
    const user = await step.do('create user', async () => createUser(event.payload));
    await step.sleep('wait a day', '1 day');
    await step.do('send tips', async () => sendTips(user));
  }
}
```

## 怎么选

| 想做的事                 | 选择              |
| ------------------------ | ----------------- |
| 立即返回，后台处理一次   | Queues            |
| 有顺序、可恢复、需要等待 | Workflows         |
| 几秒内完成的单次任务     | `ctx.waitUntil()` |
| 同时只能有一个执行       | Durable Objects   |

本章仅为资料（共享沙箱无法安全地运行队列）。部署后请在自己的账号里试验。
