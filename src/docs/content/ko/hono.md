# Hono

Node.js 초기를 지탱한 Express 같은 프레임워크는 Node.js의 `net.Socket`이나 `http.IncomingMessage`에 깊이 의존했다. Workers가 전달하는 것은 웹 표준 `Request` / `Response`이다. Express도 Node.js 호환 API(`nodejs_compat`. compatibility date가 2026-08-04 이후이면 기본으로 활성화됨)와 `cloudflare:node`의 `httpServerHandler`를 사용하면 동작하지만(공식 튜토리얼이 있다), Node.js 호환 계층을 전제로 한다.

Hono는 브라우저나 엣지 런타임이 기본으로 제공하는 **`Request`와 `Response` 객체만을 전제로 설계된 웹 프레임워크**이다. Cloudflare Workers, Deno, Bun 등에서 동일한 코드가 동작한다. Hono는 처음에는 Node.js를 염두에 두고 설계되지 않았지만, Node.js 어댑터(`@hono/node-server`)를 사용하면 Node.js에서도 동작한다. Hono 자체는 의존성이 없으며, `hono/tiny` 프리셋은 12kB 미만이다.

## 최소한의 구성

```ts
import { Hono } from "hono";

const app = new Hono();

// 라우트 정의
app.get("/", (c) => c.text("hello from hono"));

// Cloudflare Workers의 엔트리 포인트로 그대로 노출 가능
export default app;
```

## 경로 라우팅과 파라미터 추출

```ts
app.get("/users/:id", (c) => c.json({ userId: c.req.param("id") }));
app.get("/static/*", (c) => c.text(c.req.path));
app.post("/items", (c) => c.text("created", 201));

// 서브 라우터의 모듈 결합
app.route("/api/v1", apiRoutes);
```

- `:param` 형식의 경로 파라미터 추출과 `*`를 통한 와일드카드 캐치를 지원한다.
- 같은 경로에 일치하는 핸들러와 미들웨어는 등록한 순서대로 실행된다. `Response`를 반환한 핸들러에서 처리가 멈추므로, `/users/me` 같은 특수한 경로는 `/users/:id`보다 먼저, 폴백인 `*`는 마지막에 작성한다.

## 컨텍스트를 통한 입출력 작업

인수 `c`(Context)로 요청을 읽고 응답을 생성한다. 입력에 타입이 붙는 것은 `hono/validator` 같은 검증기를 거친 값뿐이며, `c.req.json()`은 Hono v4에서 `any`를 반환한다.

```ts
// 요청 정보 추출
const authHeader = c.req.header("authorization");
const queryPage = c.req.query("page");
const bodyJson = await c.req.json();

// 응답 전송
return c.json({ status: "ok", data: bodyJson }, 201);
```

내부적으로는 네이티브 `Request` / `Response`를 얇게 래핑한 것에 불과하므로, `c.req.raw`에서 원시 웹 표준 객체를 직접 추출하는 것도 가능하다.

## 미들웨어 파이프라인 결합

```ts
// 글로벌 실행 시간 측정 미들웨어. Workers에 배포하면 performance.now()는 I/O 이후에만 진행된다
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header("server-timing", `total;dur=${duration.toFixed(2)}`);
});

// 조기 종료 예시(헤더의 유무만 확인한다. 인증에는 hono/bearer-auth 등을 사용한다)
app.use("/admin/*", async (c, next) => {
  if (!c.req.header("authorization")) {
    return c.text("unauthorized", 401);
  }
  await next();
});
```

`await next()`를 끼워 넣음으로써, 요청 수신 시의 전처리와 응답 반환 시의 후처리를 단일 함수 내에서 자연스럽게 표현할 수 있다. 조건에 맞지 않을 때 조기 리턴을 수행하면, 하류 핸들러를 실행하지 않고 처리를 종료하는 안전 밸브로 작동한다.

## 타입 안전한 RPC(Remote Procedure Call)

Hono에서는 서버 측 라우트 정의로부터 클라이언트 측 RPC 클라이언트의 타입을 자동으로 도출할 수 있다.

```ts
// 서버 측(라우트의 타입 정의를 노출)
const api = new Hono().get("/posts/:id", (c) => c.json({ id: c.req.param("id"), title: "Demo" }));
export type AppType = typeof api;

// 클라이언트 측(기본 URL 외에는 URL 문자열을 쓰지 않고 타입 자동 완성으로 호출)
import { hc } from "hono/client";
const client = hc<AppType>("https://example.com");
const response = await client.posts[":id"].$get({ param: { id: "42" } });
const data = await response.json(); // { id: string, title: string }로 추론
```
