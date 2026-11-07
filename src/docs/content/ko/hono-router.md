# Hono의 내부 설계 (라우터 및 미들웨어 합성)

표면적인 라우팅 구문 너머에서, Hono는 에지 환경의 가혹한 리소스 제약을 견뎌낼 수 있는 고도의 최적화를 적용하고 있다. 라우터 엔진 전환 메커니즘과 다층 미들웨어를 단일 비동기 함수로 평탄화하는 합성 구조를 파헤친다.

## 최적화 라우터 자동 선택

Hono는 `SmartRouter`라는 총괄 계층을 가지며, 등록된 라우트의 특성에 따라 최적의 라우팅 엔진을 자동으로 선택한다.

- **RegExpRouter**: 등록된 모든 경로를 하나의 큰 정규 표현식으로 만들어, 한 번의 매칭으로 대상 핸들러를 식별한다. Hono 공식 문서는 이를 JavaScript에서 가장 빠른 라우터라고 설명한다. 다만 모든 패턴을 지원하지는 않으므로 보통 다른 라우터와 조합해 사용한다.
- **TrieRouter**: `/`로 구분한 세그먼트마다 트라이 트리를 따라간다. 모든 패턴을 지원하므로 RegExpRouter가 처리하지 못하는 라우트가 있을 때의 폴백이 된다.

매칭 우선순위는 등록 순서이다. 일치하는 핸들러와 미들웨어는 등록한 순서대로 실행되며, `Response`를 반환한 곳에서 멈춘다. 따라서 `/users/:id`를 먼저 등록하면 `/users/me`에 대한 요청도 그 핸들러가 처리하므로, 특수한 경로를 먼저 등록한다. SmartRouter가 정하는 것은 매칭에 쓸 라우터뿐이다. 첫 매칭 시점에 모든 라우트를 등록할 수 있는 첫 번째 라우터(RegExpRouter, 등록할 수 없으면 TrieRouter)로 결정된다.

## 미들웨어 합성 메커니즘

미들웨어 체인의 실체는 함수형 프로그래밍의 함수 합성(Composition)이다. 등록된 다단계 핸들러군은 요청 처리 시작 시 `compose()` 처리를 거쳐, 하나의 중첩된 비동기 콜백으로 축소된다.

```ts
const timing = async (c, next) => {
  const start = performance.now(); // Workers에서는 I/O 이후에만 진행된다
  await next(); // 다음 미들웨어 또는 최종 핸들러로 처리 이양
  const elapsed = performance.now() - start;
  c.header("server-timing", `work;dur=${elapsed}`);
};
```

- 하류의 핸들러나 미들웨어가 예외를 던져도 Hono가 이를 잡아 `app.onError()`에 전달한다(없으면 500으로 만든다). 따라서 `await next()`는 예외를 던지지 않으며 `try / finally`로 감쌀 필요가 없다. 잡힌 예외는 `c.error`로 읽을 수 있다.
- `c.set(key, value)`와 `c.get(key)`를 사용함으로써, 인증 미들웨어에서 복호화한 사용자 정보 등을 후속 핸들러로 안전하게 전달할 수 있다. 이 컨텍스트 변수에는 TypeScript의 제네릭으로 엄격한 타입을 적용할 수 있다.

## 스트리밍 전송 제어

대규모 언어 모델의 순차적 출력처럼 만들어지는 대로 순서대로 보내고 싶을 때는 `hono/streaming`의 스트리밍 헬퍼를 사용한다.

```ts
import { streamSSE, streamText } from "hono/streaming";

// 텍스트 청크 스트리밍
return streamText(c, async (stream) => {
  for (const token of textTokens) {
    await stream.write(token);
    await stream.sleep(20);
  }
});

// Server-Sent Events(SSE) 송출
return streamSSE(c, async (stream) => {
  await stream.writeSSE({ data: JSON.stringify({ event: "ping" }) });
});
```

스트림 내부에서 `stream.onAbort()`에 콜백을 등록해 두면, 클라이언트가 브라우저 탭을 닫는 등으로 연결을 끊었을 때 상위 API 호출이나 계산을 중단하는 처리를 실행할 수 있다.
