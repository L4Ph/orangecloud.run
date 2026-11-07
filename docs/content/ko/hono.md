# Hono

Hono는 표준 `Request` / `Response`만으로 동작하는 작은 웹 프레임워크입니다. 같은 코드가 Node.js, Bun, Deno, Cloudflare Workers에서 돌아가고, 의존성이 적어 기동도 빠릅니다. 먼저 "라우팅과 미들웨어 도구"로 익히면 충분합니다.

## 가장 작은 앱

```ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('hello'));

export default app; // Workers / Bun에서 그대로 동작
```

Node.js에서는 `@hono/node-server`의 `serve({ fetch: app.fetch })`로 띄웁니다.

## 라우팅

```ts
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
app.get('/files/*', (c) => c.text(c.req.path));
app.post('/users', (c) => c.text('created', 201));
app.route('/admin', adminRoutes); // 다른 라우터를 붙임
```

- `:id`는 파라미터, `*`는 와일드카드
- `app.route()`로 라우터를 다른 파일(`routes/users.ts` 등)로 분리
- 매칭은 등록 순서가 아니라 정적 > 파라미터 > 와일드카드 순

## 요청

```ts
c.req.param('id');
c.req.query('page');
c.req.header('authorization');
await c.req.json();
await c.req.formData();
```

`c.req.raw`로 원본 `Request`에 접근합니다.

## 응답

```ts
c.text('ok');
c.json({ ok: true }, 201);
c.html('<h1>hi</h1>');
c.redirect('/login');
c.body(stream);
```

상태 코드는 두 번째 인자, 헤더는 `c.header('x-foo', 'bar')`. 세밀하게 조립할 때는 `c.newResponse()`.

## 미들웨어

```ts
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  c.header('server-timing', `app;dur=${performance.now() - start}`);
});

app.use('/admin/*', async (c, next) => {
  if (!c.req.header('authorization')) return c.text('forbidden', 403);
  await next();
});
```

- `await next()` 앞이 전처리, 뒤가 후처리
- `c.set('user', user)` / `c.get('user')`로 하류에 값 전달
- `logger()`, `cors()`, `basicAuth()` 같은 기본 미들웨어가 있습니다

## 입력 검증

```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

app.post('/users', zValidator('json', z.object({ name: z.string().min(1) })), (c) => {
  const { name } = c.req.valid('json');
  return c.json({ name }, 201);
});
```

검증된 값이 타입과 함께 핸들러에 도착합니다.

## 에러 처리

```ts
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});

app.notFound((c) => c.json({ error: 'not found' }, 404));
```

`HTTPException`을 던지면 `onError`가 잡습니다.

## 타입 RPC

```ts
// 서버
const api = new Hono().get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
export type AppType = typeof api;

// 클라이언트
import { hc } from 'hono/client';
const client = hc<AppType>('/');
const res = await client.users[':id'].$get({ param: { id: '1' } });
```

경로 문자열을 직접 쓰지 않아도 됩니다.

## 로컬에서 실행

```sh
npm create hono@latest
npm run dev
```

라우터 내부와 RPC 타입의 원리는 [Hono의 라우터와 미들웨어](/docs/hono)에서 다룹니다.

## 이 에디터에서 실행하지 않는 이유

이 사이트의 에디터에서는 실행할 수 없습니다. `import 'hono'`를 해석하려면 미리 번들해야 하며, 로컬에서는 `npm create hono@latest`로 시작하면 됩니다.
