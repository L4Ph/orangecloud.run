# Hono のルーターとミドルウェア

基本を押さえたあとで読む、実装寄りの話。ルーターの選び方、ミドルウェアの合成、型と RPC がどう繋がっているかを見ます。

## ルーターは差し替えられる

Hono は `SmartRouter` が複数の実装を切り替えます。既定は `RegExpRouter`（1 本の正規表現にまとめて高速）と `TrieRouter` の組み合わせで、ルートが多くなっても崩れにくい構成です。`new Hono({ router: new TrieRouter() })` のように明示指定もできます。

マッチングは登録順ではなく、静的なセグメント → パラメータ → ワイルドカードの順に強い方が勝ちます。`/users/me` が `/users/:id` に吸われることはありません。

## ミドルウェアは関数の合成

`await next()` は「残りの処理を呼ぶ」だけの関数です。Hono は登録されたミドルウェアを `compose()` で 1 本の関数に畳んでから実行します。

```ts
const timing = async (c, next) => {
  const start = performance.now();
  await next();
  c.header('server-timing', `app;dur=${performance.now() - start}`);
};
```

- 後処理は `next()` の後に書く。例外が飛んでも `try/finally` で担保できる
- 早期 return すると後続は実行されない（認証の定番）
- `c.set` / `c.get` はリクエストスコープの変数。型は `new Hono<{ Variables: { user: User } }>()` で付けられる
- ルート単位でも `app.get('/x', mw1, mw2, handler)` と並べられる

## 型が端点まで届く仕組み

Hono の型は「ルート定義の型」をそのままクライアントへ渡します。`hc<typeof app>()` は `AppType` から URL と入出力の型を組み立てるので、パスやボディの形を文字列で再宣言しません。

```ts
const api = new Hono().post('/posts', zValidator('json', schema), (c) => c.json({ id: 1 }, 201));

export type AppType = typeof api;
```

```ts
const client = hc<AppType>('https://api.example.com');
await client.posts.$post({ json: { title: 'hello' } });
```

分割したルーターは `app.route('/v1', api)` の型も保たれます。`InferRequestType` / `InferResponseType` で個別に取り出すこともできます。

## ストリーミング

```ts
return c.streamText(async (stream) => {
  for (const token of tokens) await stream.write(token);
});

return c.streamSSE(async (stream) => {
  await stream.writeSSE({ data: 'hello' });
});
```

長時間の LLM 応答やログ流しはここ。`stream.onAbort()` で切断も拾えます。

## テスト

`app.request()` はサーバーを立てずにリクエストを投げられます。Workers でも Node でも同じテストが書けます。

```ts
const res = await app.request('/users/1');
expect(res.status).toBe(200);
```

## パフォーマンスの勘所

- ミドルウェアはグローバルに増やさない。ルート単位で必要な分だけ
- `c.req.json()` は 1 回だけ。二度読むとストリームが空になる
- 大きいレスポンスは `c.body(stream)` で流す。`await res.text()` で全部メモリに載せない
- ルートが数百を超えたら `RegExpRouter` の登録数上限に注意し、分割を検討する

## 参考

- `hono.dev` のドキュメント（Router、Middleware、RPC、Testing）
- `@hono/zod-validator` でバリデーションと型推論を同時に
