# Hono

Node.js 초기를 지탱한 Express 같은 프레임워크는 OS의 `net.Socket`이나 Node 고유의 `http.IncomingMessage`에 깊이 의존했다. 그 때문에 이러한 유산이 없는 Cloudflare Workers 같은 웹 표준 준수 엣지 환경으로 그대로 가져올 수 없다.

Hono는 브라우저나 엣지 런타임이 기본으로 제공하는 **`Request`와 `Response` 객체만을 전제로 설계된 웹 프레임워크**이다. Node.js, Bun, Deno, Cloudflare Workers 어디서나 동일한 코드베이스가 의존성 없이 극소형 풋프린트로 동작한다.

## 최소한의 구성

```ts
import { Hono } from "hono";

const app = new Hono();

// 루트 정의
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
- 정적 경로, 파라미터 포함 경로, 와일드카드가 섞여 있을 경우, 정의 순서와 상관없이 가장 구체적인 경로가 우선적으로 매칭된다.

## 컨텍스트를 통한 입출력 작업

인수 `c`(Context)를 통해 타입 안전한 요청 파싱과 응답 생성을 수행한다.

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
// 글로벌 실행 시간 측정 미들웨어
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header("server-timing", `total;dur=${duration.toFixed(2)}`);
});

// 인증 체크와 조기 종료
app.use("/admin/*", async (c, next) => {
  if (!c.req.header("authorization")) {
    return c.text("unauthorized", 401);
  }
  await next();
});
```

`await next()`를 끼워 넣음으로써, 요청 수신 시의 전처리와 응답 반환 시의 후처리를 단일 함수 내에서 자연스럽게 표현할 수 있다. 조건에 맞지 않을 때 조기 리턴을 수행하면, 하류 핸들러를 실행하지 않고 처리를 종료하는 안전 밸브로 작동한다.

## 타입 안전한 RPC(Remote Procedure Call)

Hono의 가장 큰 강점 중 하나는 서버 측 루트 정의에서 클라이언트 측 RPC 클라이언트의 타입을 자동으로 도출할 수 있다는 점이다.

```ts
// 서버 측(루트의 타입 정의를 노출)
const api = new Hono().get("/posts/:id", (c) => c.json({ id: c.req.param("id"), title: "Demo" }));
export type AppType = typeof api;

// 클라이언트 측(URL 문자열을 전혀 쓰지 않고 완전 타입 완성으로 호출)
import { hc } from "hono/client";
const client = hc<AppType>("https://example.com");
const response = await client.posts[":id"].$get({ param: { id: "42" } });
const data = await response.json(); // { id: string, title: string }로 추론
```
