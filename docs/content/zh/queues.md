# 异步处理设计（Queues 与 Workflows）

如果试图在接收 HTTP 请求的当下，就完成发送邮件、生成图片缩略图甚至调用外部 Webhook，系统会迅速变得脆弱。因为外部服务的延迟会导致响应被拦截，从而引发超时或连接耗尽。

作为异步处理的基础，Cloudflare 提供了 **Queues** 和 **Workflows** 这两种工具。两者的区别在于处理的 **粒度** 和 **持久性（状态保持能力）**。

## Queues（异步消息队列）

Queues 是一种用于安全地解耦短时间内完成的单次后台任务的机制。生产者（Worker）将消息投入队列，消费者（另一个 Worker）则以批次形式异步处理这些消息。

```js
// 生产者端：立即放入消息并返回 HTTP 响应
await env.EMAIL_QUEUE.send({
  to: 'user@example.com',
  template: 'welcome_v1',
  payload: { name: 'Alice' },
});

// 消费者端：在后台统一处理
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await deliverEmail(message.body);
        message.ack(); // 通知正常完成
      } catch (err) {
        message.retry(); // 失败时自动重试
      }
    }
  },
};
```

- 消息最大大小为 64KB，队列内的最大保留期限默认为 4 天（最多 14 天）。
- 如果消费者端抛出异常，将根据设定的策略进行自动重试；若超过上限，则被移至死信队列（DLQ）。
- 最佳用途：事务性邮件发送、日志汇总的批处理、向外部 Webhook 进行异步分发。

## Workflows（具有持久性的长时间编排）

当需要在数分钟到数日内依次执行多个步骤，且即使服务器在过程中重启，也能准确地从前一步继续执行（Durable Execution）时，应采用 Workflows 而非 Queues。

```ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

export class UserOnboardingWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // 步骤 1：创建外部支付账户
    const account = await step.do('create-billing-account', async () => {
      return await createStripeCustomer(event.payload.email);
    });

    // 步骤 2：等待 3 天（不消耗 CPU 时间或进程，无需付费）
    await step.sleep('wait-trial-period', '3 days');

    // 步骤 3：发送跟进通知
    await step.do('send-checkin-notification', async () => {
      await sendFollowUpEmail(account.id);
    });
  }
}
```

每个步骤的执行结果将作为检查点保存在基础设施层。即使进程在途中被强制终止，已经完成的步骤也不会重复执行，而是严格地从未完成的步骤开始重新执行。

## 架构选择的判断标准

| 需求 | 应采用的机制 |
| --- | --- |
| 数秒内完成的单次异步任务 | `ctx.waitUntil()`（在同一 isolate 内后台执行） |
| 需要平滑大量任务并以批次形式进行异步处理 | **Queues** |
| 具有等待期间（`sleep`）或多阶段顺序依赖的长时间处理 | **Workflows** |
| 需要将针对同一资源的并发写入在同一处串行化 | **Durable Objects** |
