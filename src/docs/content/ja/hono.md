# Hono

Node.js 黎明期を支えた Express などのフレームワークは、OS の `net.Socket` や Node 固有の `http.IncomingMessage` に深く依存していた。そのため、それらの遺産を持たない Cloudflare Workers のような Web 標準準拠のエッジ環境へそのまま持ち込むことはできない。

Hono は、ブラウザやエッジランタイムが標準装備する **`Request` と `Response` オブジェクトのみを前提に設計された Web フレームワーク**である。Node.js、Bun、Deno、Cloudflare Workers を問わず、同一のコードベースが依存関係なしに極小フットプリントで動作する。

## 最小限の構成

```ts
import { Hono } from "hono";

const app = new Hono();

// ルート定義
app.get("/", (c) => c.text("hello from hono"));

// Cloudflare Workers のエントリポイントとしてそのまま公開できる
export default app;
```

## パスルーティングとパラメータ抽出

```ts
app.get("/users/:id", (c) => c.json({ userId: c.req.param("id") }));
app.get("/static/*", (c) => c.text(c.req.path));
app.post("/items", (c) => c.text("created", 201));

// サブルーターのモジュール結合
app.route("/api/v1", apiRoutes);
```

- `:param` 形式によるパスパラメータの抽出と、`*` によるワイルドカードキャッチに対応する。
- 静的パス、パラメータ付きパス、ワイルドカードが混在する場合、定義順序に関わらず最も具体的なパスが優先してマッチする。

## コンテキストを通じた入出力操作

引数 `c`（Context）を通じて、型安全なリクエストのパースとレスポンス生成を行う。

```ts
// リクエスト情報の取り出し
const authHeader = c.req.header("authorization");
const queryPage = c.req.query("page");
const bodyJson = await c.req.json();

// レスポンスの送出
return c.json({ status: "ok", data: bodyJson }, 201);
```

内部的にはネイティブの `Request` / `Response` を薄くラップしているにすぎないため、`c.req.raw` から生の Web 標準オブジェクトを直接取り出すことも可能である。

## ミドルウェアパイプラインの結合

```ts
// グローバルな実行時間計測ミドルウェア
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header("server-timing", `total;dur=${duration.toFixed(2)}`);
});

// 認証チェックと早期離脱
app.use("/admin/*", async (c, next) => {
  if (!c.req.header("authorization")) {
    return c.text("unauthorized", 401);
  }
  await next();
});
```

`await next()` を挟むことで、リクエスト受信時の前処理とレスポンス返却時の後処理を単一の関数内で自然に表現できる。条件に合致しない場合に早期リターンを行えば、下流のハンドラを実行させずに処理を打ち切る安全弁として機能する。

## 型安全な RPC（Remote Procedure Call）

Hono の最大の強みの一つは、サーバー側のルート定義からクライアント側の RPC クライアントの型を自動導出できる点にある。

```ts
// サーバー側（ルートの型定義を公開）
const api = new Hono().get("/posts/:id", (c) => c.json({ id: c.req.param("id"), title: "Demo" }));
export type AppType = typeof api;

// クライアント側（URL 文字列を一切書かずに完全型補完で呼び出す）
import { hc } from "hono/client";
const client = hc<AppType>("https://example.com");
const response = await client.posts[":id"].$get({ param: { id: "42" } });
const data = await response.json(); // { id: string, title: string } として推論
```
