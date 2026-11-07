# このサイトの仕組み

ここまでの章で使ってきた「実行」ボタンが、裏で何をしているかの話です。Cloudflare の機能だけでできているので、そのまま自分のサービスに流用できます。

## 実行のたびに Worker を作る

このサイトは **Dynamic Workers** を使っています。親の Worker が `env.LOADER`（Worker Loader バインディング）を持ち、リクエストごとに子の Worker を組み立てます。

```ts
const worker = env.LOADER.get(`run-${hash(code)}`, () => ({
  compatibilityDate: '2026-02-24',
  mainModule: 'index.js',
  modules: { 'index.js': wrap(code) },
  env: { KV: kvStub, DB: env.DB },
  globalOutbound: null,
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request('https://sandbox.internal/'));
```

- `load()` は毎回新品、`get(id, callback)` は id ごとに isolate を再利用する
- `globalOutbound: null` で外向き通信を塞ぐ。`fetch` も `connect` も失敗する
- `limits` で CPU とサブリクエストを絞る。暴走しても自分の Worker 以上にはならない
- `compatibilityDate` / `compatibilityFlags` は本番の Worker と同じ意味

コンテナではなく isolate を選んだのは、起動がミリ秒で、1 リクエストごとに使い捨てるのに向いているからです。

## バインディングは「渡せるもの」と「渡せないもの」がある

子の `env` に渡せるのは、構造化クローンできる値と Service Binding だけです。

| バインディング | 渡し方                                                     |
| -------------- | ---------------------------------------------------------- |
| D1             | そのまま（clone できる）                                   |
| Durable Object | `namespace.get(id)` のスタブ（Service Binding）            |
| KV / R2 / AI   | namespace 自体は渡せない → Durable Object のメソッドを中継 |

たとえば KV は、`get` / `put` / `delete` / `list` を持つ Durable Object を 1 つ置き、そのスタブを `env.KV` として渡しています。呼び出し側のコードは本物の KV とほぼ同じ形です。

## Turnstile は最初の 1 回だけ

実行の入口で Turnstile を検証し、成功したら署名付き Cookie を返します。以降は Cookie を見て素通りさせるので、毎クリックでチャレンジは出ません。トークン自体は単発なので、検証のたびに新しいものが必要です。

## 費用の勘所

- Dynamic Workers は「1 日あたりに作ったユニークな Worker 数」で課金される。同じコードは同じ id で `get()` して再利用する。無料枠は月 1,000 個、超えると 1 個あたり 1 日 $0.002
- id はコードから作る。改行コードや末尾の改行だけの違いは同じ id に寄せるので、教材のコードをそのまま実行する人は全員で 1 個を共有する
- CPU は 100ms で打ち切る。待ち時間は課金されないので、外部 API 待ちは安い
- Workers AI は安いモデルに固定し、回数の上限を決めておく

## 自分で作るときの型

1. 親 Worker が Worker Loader を持つ
2. ユーザーのコードを `modules` に詰めて `load()` / `get()`
3. `env` は必要な分だけ、Service Binding で絞って渡す
4. 外向き通信は塞ぐか、中継用の Service Binding に限定する
5. CPU とサブリクエストに上限を置く

この 5 つで、安全に他人のコードを実行する場所が作れます。
