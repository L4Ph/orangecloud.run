# Hono

Node.js 黎明期を支えた Express などのフレームワークは、Node.js の `net.Socket` や `http.IncomingMessage` に深く依存していた。Workers が渡すのは Web 標準の `Request` / `Response` である。Express も、Node.js 互換の API（`nodejs_compat`。compatibility date が 2026-08-04 以降なら既定で有効）と `cloudflare:node` の `httpServerHandler` を使えば動くが（公式チュートリアルがある）、Node.js 互換の層が前提になる。

Hono は、ブラウザやエッジランタイムが標準装備する **`Request` と `Response` オブジェクトのみを前提に設計された Web フレームワーク**である。Cloudflare Workers、Deno、Bun などで同じコードが動く。Hono は当初 Node.js 向けには設計されていなかったが、Node.js アダプター（`@hono/node-server`）を使えば Node.js でも動く。Hono 自体は依存パッケージを持たず、`hono/tiny` プリセットは 12kB 未満である。

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
- 同じパスに合致するハンドラとミドルウェアは、登録した順に実行される。`Response` を返したハンドラで処理は止まるので、`/users/me` のような特殊なパスは `/users/:id` より先に、フォールバックの `*` は最後に書く。

## コンテキストを通じた入出力操作

引数 `c`（Context）から、リクエストの読み取りとレスポンスの生成を行う。入力に型が付くのは `hono/validator` などのバリデータを通した値だけで、`c.req.json()` は Hono v4 では `any` を返す。

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
// グローバルな実行時間計測ミドルウェア。Workers に配備すると performance.now() は I/O の後にしか進まない
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header("server-timing", `total;dur=${duration.toFixed(2)}`);
});

// 早期離脱の例（ヘッダーの有無を見るだけ。認証には hono/bearer-auth などを使う）
app.use("/admin/*", async (c, next) => {
  if (!c.req.header("authorization")) {
    return c.text("unauthorized", 401);
  }
  await next();
});
```

`await next()` を挟むことで、リクエスト受信時の前処理とレスポンス返却時の後処理を単一の関数内で自然に表現できる。条件に合致しない場合に早期リターンを行えば、下流のハンドラを実行させずに処理を打ち切る安全弁として機能する。

## 型安全な RPC（Remote Procedure Call）

Hono では、サーバー側のルート定義からクライアント側の RPC クライアントの型を自動で導出できる。

```ts
// サーバー側（ルートの型定義を公開）
const api = new Hono().get("/posts/:id", (c) => c.json({ id: c.req.param("id"), title: "Demo" }));
export type AppType = typeof api;

// クライアント側（ベース URL 以外の URL 文字列を書かずに、型補完を効かせて呼び出す）
import { hc } from "hono/client";
const client = hc<AppType>("https://example.com");
const response = await client.posts[":id"].$get({ param: { id: "42" } });
const data = await response.json(); // { id: string, title: string } として推論
```
