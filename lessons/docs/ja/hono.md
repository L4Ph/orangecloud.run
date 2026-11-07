# Hono

Hono は Web 標準の `Request` / `Response` だけで動く小さな Web フレームワークです。同じコードが Node.js、Bun、Deno、Cloudflare Workers で動き、依存が少ないので起動も速い。まずは「ルーティングとミドルウェアの道具」として覚えるのが近道です。

## 最小のアプリ

```ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('hello'));

export default app; // Workers / Bun はこれで動く
```

Node.js なら `@hono/node-server` の `serve({ fetch: app.fetch })` で起動します。

## ルーティング

```ts
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
app.get('/files/*', (c) => c.text(c.req.path));
app.post('/users', (c) => c.text('created', 201));
app.route('/admin', adminRoutes); // ルーターをまとめる
```

- `:id` はパラメータ、`*` はワイルドカード
- `app.route()` で別ファイルのルーターを生やせる（`routes/users.ts` など）
- ルートは登録順ではなく、静的なほど優先される

## リクエスト

```ts
c.req.param('id');
c.req.query('page');
c.req.header('authorization');
await c.req.json();
await c.req.formData();
```

`c.req.raw` で元の `Request` に触れます。

## レスポンス

```ts
c.text('ok');
c.json({ ok: true }, 201);
c.html('<h1>hi</h1>');
c.redirect('/login');
c.body(stream);
```

ステータスは第 2 引数、ヘッダーは `c.header('x-foo', 'bar')`。`c.newResponse()` で細かく組み立てることもできます。

## ミドルウェア

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

- `await next()` の前が前処理、後が後処理
- `c.set('user', user)` / `c.get('user')` で下流へ値を渡す
- `logger()`、`cors()`、`basicAuth()` など標準のミドルウェアが揃っている

## 入力の検証

```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

app.post('/users', zValidator('json', z.object({ name: z.string().min(1) })), (c) => {
  const { name } = c.req.valid('json');
  return c.json({ name }, 201);
});
```

検証結果は型としてハンドラに届きます。

## エラー

```ts
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});

app.notFound((c) => c.json({ error: 'not found' }, 404));
```

`HTTPException` を投げれば `onError` で拾えます。

## 型付き RPC

```ts
// server
const api = new Hono().get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
export type AppType = typeof api;

// client
import { hc } from 'hono/client';
const client = hc<AppType>('/');
const res = await client.users[':id'].$get({ param: { id: '1' } });
```

パス文字列を書かずに呼べるのが利点です。

## 手元で動かす

```sh
npm create hono@latest
npm run dev
```

ルーターの内部や RPC の仕組みまで踏み込みたいときは [Hono のルーターとミドルウェア](/docs/hono) へ。

## このエディタで動かさない理由

ここのサンドボックスは素の JavaScript モジュールしか受け取れません。`import 'hono'` を解決するには事前にバンドルが必要なので、この章は資料のみです。
