# Queues and Workflows

Both handle work that does not finish during the request. The difference is **granularity**.

## Queues (asynchronous messages)

- A Worker `send()`s a message; another Worker (the consumer) processes a batch
- Failures retry automatically, then go to a Dead Letter Queue
- 64KB per message, retained for 4 days by default (up to 14)
- Good for: sending mail, image conversion, webhook retries, log post-processing

```js
// producer
await env.QUEUE_EMAILS.send({ to: 'a@example.com', template: 'welcome' });

// consumer (queues/emails.ts)
export const queue = defineQueue(async (batch) => {
  for (const message of batch.messages) {
    await sendEmail(message.body);
  }
});
```

You pay per message times operations (roughly 3 per message). The free tier is 10k operations a day.

## Workflows (long-running choreography)

- Steps run in order, and **resume where they stopped** after a failure
- `step.sleep('3 days')` waits without billing
- Good for: invoice closing, staged onboarding mail, anything taking minutes to days

```js
export class Onboarding extends WorkflowEntrypoint {
  async run(event, step) {
    const user = await step.do('create user', async () => createUser(event.payload));
    await step.sleep('wait a day', '1 day');
    await step.do('send tips', async () => sendTips(user));
  }
}
```

## Choosing

| You want                                   | Pick              |
| ------------------------------------------ | ----------------- |
| Answer now, process once in the background | Queues            |
| Ordering, resumption, waiting              | Workflows         |
| A one-off that takes seconds               | `ctx.waitUntil()` |
| Exactly one execution at a time            | Durable Objects   |

Queues cannot run in the shared sandbox, so this article shows the code only. Try it in your own account.
