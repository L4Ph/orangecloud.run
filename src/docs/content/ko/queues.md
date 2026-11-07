# 비동기 처리 설계 (Queues와 Workflows)

HTTP 요청을 수신하는 즉시 이메일 발송, 이미지 썸네일 생성, 외부 Webhook 호출까지 완료하려 하면 시스템은 순식간에 취약해진다. 외부 서비스의 지연이 클라이언트 응답을 차단하여 타임아웃이나 커넥션 고갈을 일으키기 때문이다.

비동기 처리의 기반으로 Cloudflare는 **Queues**와 **Workflows**라는 두 가지 도구를 제공한다. 두 도구의 차이는 다루는 처리의 **입도**와 **내구성(상태 유지 능력)**에 있다.

## Queues (비동기 메시지 큐)

Queues는 짧은 시간 내에 완료되는 단발성 백그라운드 태스크를 안전하게 분리하기 위한 메커니즘이다. 프로듀서(Worker)가 메시지를 큐에 투입하고, 컨슈머(다른 Worker)가 이를 배치 단위로 비동기적으로 처리한다.

```js
// 프로듀서 측: 즉시 메시지를 실어 HTTP 응답 반환
await env.EMAIL_QUEUE.send({
  to: "user@example.com",
  template: "welcome_v1",
  payload: { name: "Alice" },
});

// 컨슈머 측: 백그라운드에서 일괄 처리
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await deliverEmail(message.body);
        message.ack(); // 정상 완료 알림
      } catch (err) {
        message.retry(); // 실패 시 자동 재시도
      }
    }
  },
};
```

- 메시지의 최대 크기는 64KB, 큐 내 최대 유지 기간은 기본 4일(최대 14일)이다.
- 컨슈머 측에서 예외가 발생하면 설정된 정책에 따라 자동 재시도가 이루어지며, 상한을 초과한 경우에는 데드레터 큐(DLQ)로 이동된다.
- 최적의 활용 사례: 트랜잭션 이메일 발송, 로그 집계 배치 처리, 외부 Webhook으로의 비동기 디스패치.

## Workflows (내구성을 갖춘 장시간 오케스트레이션)

수 분에서 수일에 걸쳐 여러 단계를 순차적으로 실행하고, 중간에 서버가 재시작되더라도 정확히 직전 단계부터 재개(Durable Execution)시키고 싶을 때는 Queues 대신 Workflows를 채택한다.

```ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

export class UserOnboardingWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // 단계 1: 외부 결제 계정 생성
    const account = await step.do("create-billing-account", async () => {
      return await createStripeCustomer(event.payload.email);
    });

    // 단계 2: 3일간 대기 (CPU 시간이나 프로세스는 소비되지 않으며 비용 청구 없음)
    await step.sleep("wait-trial-period", "3 days");

    // 단계 3: 후속 알림 발송
    await step.do("send-checkin-notification", async () => {
      await sendFollowUpEmail(account.id);
    });
  }
}
```

각 단계의 실행 결과는 인프라 계층에 체크포인트로 저장된다. 도중에 프로세스가 강제 종료되더라도 이미 완료된 단계가 중복 실행되지 않으며, 미완료 단계부터 엄격하게 재개된다.

## 아키텍처 선정 판단 기준

| 요구사항                                                     | 채택해야 할 메커니즘                                    |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| 수 초 이내에 완료되는 단발성 비동기 태스크                   | `ctx.waitUntil()` (동일 isolate 내에서 백그라운드 실행) |
| 대량의 태스크를 평활화하여 배치로 비동기 처리하고 싶을 때    | **Queues**                                              |
| 대기 기간(`sleep`)이나 다단계 순서 의존성이 있는 장시간 처리 | **Workflows**                                           |
| 동일 리소스에 대한 병렬 쓰기를 한 곳에서 직렬화하고 싶을 때  | **Durable Objects**                                     |
