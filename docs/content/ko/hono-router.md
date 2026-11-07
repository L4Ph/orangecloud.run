# Hono의 내부 설계 (라우터 및 미들웨어 합성)

표면적인 라우팅 구문 너머에서, Hono는 에지 환경의 가혹한 리소스 제약을 견뎌낼 수 있는 고도의 최적화를 적용하고 있다. 라우터 엔진 전환 메커니즘과 다층 미들웨어를 단일 비동기 함수로 평탄화하는 합성 구조를 파헤친다.

## 최적화 라우터 자동 선택

Hono는 `SmartRouter`라는 총괄 계층을 가지며, 등록된 라우트의 특성에 따라 최적의 라우팅 엔진을 자동으로 선택한다.

- **RegExpRouter**: 등록된 모든 경로를 단일한 긴 정규 표현식으로 컴파일하여, 한 번의 정규 표현식 매칭으로 대상 핸들러를 식별한다. 수십~수백 개의 라우트에 대해서도 상수 시간에 가까운 압도적인 속도로 분기를 완료한다.
- **TrieRouter**: 트리 구조를 사용하여 URL 세그먼트를 한 글자씩 탐색한다. 와일드카드나 정규 표현식 캡처가 복잡하게 얽힌 라우트군에서 안정적인 폴백으로 기능한다.

매칭 우선순위는 배열의 등록 순서가 아니다. 완전 일치하는 정적 세그먼트가 가장 강하게 평가되고, 다음으로 경로 파라미터, 가장 우선순위가 낮은 것으로서 와일드카드(`*`) 순으로 평가된다. 따라서 `/users/me`라는 특수 엔드포인트가 먼저 등록된 `/users/:id`로 잘못 흡수되는 일은 구조상 발생하지 않는다.

## 미들웨어 합성 메커니즘

미들웨어 체인의 실체는 함수형 프로그래밍의 함수 합성(Composition)이다. 등록된 다단계 핸들러군은 요청 처리 시작 시 `compose()` 처리를 거쳐, 하나의 중첩된 비동기 콜백으로 축소된다.

```ts
const timing = async (c, next) => {
  const start = performance.now();
  try {
    await next(); // 다음 미들웨어 또는 최종 핸들러로 처리 이양
  } finally {
    const elapsed = performance.now() - start;
    c.header('server-timing', `work;dur=${elapsed}`);
  }
};
```

- 후처리에서 예외가 발생하더라도 확실하게 클린업을 수행할 수 있도록, `try / finally` 구문으로 `await next()`를 감싸는 것이 견고한 패턴이다.
- `c.set(key, value)`와 `c.get(key)`를 사용함으로써, 인증 미들웨어에서 복호화한 사용자 정보 등을 후속 핸들러로 안전하게 전달할 수 있다. 이 컨텍스트 변수에는 TypeScript의 제네릭으로 엄격한 타입을 적용할 수 있다.

## 스트리밍 전송 제어

대규모 언어 모델의 순차적 출력이나 대용량 파일의 실시간 전송에는 표준 응답 버퍼링 대신 스트리밍 헬퍼를 사용한다.

```ts
// 텍스트 청크 스트리밍
return c.streamText(async (stream) => {
  for (const token of textTokens) {
    await stream.write(token);
    await stream.sleep(20);
  }
});

// Server-Sent Events(SSE) 송출
return c.streamSSE(async (stream) => {
  await stream.writeSSE({ data: JSON.stringify({ event: 'ping' }) });
});
```

스트림 내부에서 `stream.onAbort()` 리스너를 등록해 두면, 클라이언트가 브라우저 탭을 닫는 등으로 통신을 끊는 순간 이를 감지하여, 불필요한 상위 API 소비나 계산 리소스 낭비를 즉시 중단할 수 있다.
