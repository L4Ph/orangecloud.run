# Asynchronous Processing Design (Queues and Workflows)

Attempting to complete tasks—such as sending emails, generating image thumbnails, or calling external Webhooks—immediately upon receiving an HTTP request makes the system fragile. This is because delays from external services can block responses to the client, leading to timeouts or connection exhaustion.

Cloudflare provides two fundamental tools for asynchronous processing: **Queues** and **Workflows**. The difference between the two lies in the **granularity** of the processing they handle and their **durability (state retention capability)**.

## Queues (Asynchronous Message Queues)

Queues are a mechanism for safely decoupling single-shot background tasks that complete quickly. A producer (Worker) pushes messages into a queue, and a consumer (another Worker) processes them asynchronously in batches.

```js
// Producer side: Immediately queue messages and return an HTTP response
await env.EMAIL_QUEUE.send({
  to: 'user@example.com',
  template: 'welcome_v1',
  payload: { name: 'Alice' },
});

// Consumer side: Process messages in bulk in the background
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await deliverEmail(message.body);
        message.ack(); // Signal successful completion
      } catch (err) {
        message.retry(); // Automatic retry on failure
      }
    }
  },
};
```

- Maximum message size is 64KB; the default maximum retention period in the queue is 4 days (up to 14 days).
- If an exception is thrown on the consumer side, automatic retries are performed according to a configured policy; if the limit is exceeded, the message is moved to a Dead Letter Queue (DLQ).
- Best use cases: Transactional email sending, batch processing of log aggregation, and asynchronous dispatch to external Webhooks.

## Workflows (Durable, Long-Term Orchestration)

When you need to execute multiple steps sequentially over several minutes to several days, and ensure the system resumes exactly from the previous step (Durable Execution) even if the server restarts midway, you adopt Workflows instead of Queues.

```ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

export class UserOnboardingWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Step 1: Create external billing account
    const account = await step.do('create-billing-account', async () => {
      return await createStripeCustomer(event.payload.email);
    });

    // Step 2: Wait for 3 days (no CPU time or process consumption, zero cost)
    await step.sleep('wait-trial-period', '3 days');

    // Step 3: Send follow-up notification
    await step.do('send-checkin-notification', async () => {
      await sendFollowUpEmail(account.id);
    });
  }
}
```

The execution results of each step are saved as checkpoints in the infrastructure layer. Even if a process is forcibly terminated midway, previously completed steps will not be executed redundantly; execution will strictly resume from unfinished steps.

## Architecture Selection Criteria

| Requirement | Recommended Mechanism |
| --- | --- |
| Single-shot asynchronous tasks that complete within a few seconds | `ctx.waitUntil()` (background execution within the same isolate) |
| Large volumes of tasks to be smoothed and processed asynchronously in batches | **Queues** |
| Long-running processes with waiting periods (`sleep`) or multi-step sequence dependencies | **Workflows** |
| Concurrent writes to the same resource to be serialized in a single location | **Durable Objects** |
