# Hono의 라우터와 미들웨어

기본을 익힌 뒤 읽는 구현 쪽 이야기. 라우터 선택, 미들웨어 합성, 타입이 클라이언트까지 이어지는 방식을 봅니다.

## 라우터는 교체 가능

`SmartRouter`가 구현을 골라 줍니다. 기본은 라우트를 하나의 정규식으로 모으는 `RegExpRouter`와 `TrieRouter`의 조합이라 라우트가 많아도 무너지지 않습니다. `new Hono({ router: new TrieRouter() })`처럼 직접 지정할 수도 있습니다.

매칭은 등록 순서가 아니라 정적 세그먼트 > 파라미터 > 와일드카드 순으로 강한 쪽이 이깁니다. `/users/me`가 `/users/:id`에 먹히지 않습니다.

## 미들웨어는 함수 합성

`await next()`는 "나머지 체인을 호출"할 뿐입니다. Hono는 등록된 미들웨어를 `compose()`로 하나의 함수로 접은 뒤 실행합니다.

```ts
const timing = async (c, next) => {
  const start = performance.now();
  await next();
  c.header('server-timing', `app;dur=${performance.now() - start}`);
};
```

- 후처리는 `next()` 뒤에 씁니다. 반드시 실행해야 하면 `try/finally`
- 일찍 return하면 뒤쪽은 실행되지 않습니다(인증의 정석)
- `c.set` / `c.get`은 요청 스코프. `new Hono<{ Variables: { user: User } }>()`로 타입을 붙입니다
- 라우트 단위로도 붙일 수 있습니다: `app.get('/x', mw1, mw2, handler)`

## 타입이 엔드포인트까지 가는 방식

Hono는 라우트 정의의 타입을 그대로 클라이언트에 넘깁니다. `hc<typeof app>()`는 `AppType`에서 URL과 입출력 타입을 만들기 때문에 경로나 body 모양을 다시 쓰지 않습니다.

```ts
const api = new Hono().post('/posts', zValidator('json', schema), (c) => c.json({ id: 1 }, 201));

export type AppType = typeof api;
```

```ts
const client = hc<AppType>('https://api.example.com');
await client.posts.$post({ json: { title: 'hello' } });
```

`app.route('/v1', api)`로 붙여도 타입이 유지됩니다. `InferRequestType` / `InferResponseType`로 개별 추출도 가능합니다.

## 스트리밍

```ts
return c.streamText(async (stream) => {
  for (const token of tokens) await stream.write(token);
});

return c.streamSSE(async (stream) => {
  await stream.writeSSE({ data: 'hello' });
});
```

긴 LLM 응답이나 로그 흘리기에 씁니다. `stream.onAbort()`로 끊김도 잡습니다.

## 테스트

`app.request()`는 서버를 띄우지 않고 요청을 보냅니다. Workers와 Node에서 같은 테스트가 됩니다.

```ts
const res = await app.request('/users/1');
expect(res.status).toBe(200);
```

## 성능 포인트

- 모든 미들웨어를 전역에 달지 말고 라우트 범위로
- `c.req.json()`은 한 번만. 두 번째는 빈 스트림
- 큰 응답은 `c.body(stream)`으로 흘리기. 통째로 버퍼링하지 않기
- 라우트가 수백 개를 넘으면 `RegExpRouter` 등록 한도를 보고 분할 검토

## 참고

- `hono.dev` 문서 (Router, Middleware, RPC, Testing)
- `@hono/zod-validator`로 검증과 타입 추론을 함께
