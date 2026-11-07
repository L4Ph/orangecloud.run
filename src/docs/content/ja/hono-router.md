# Hono の内部設計（ルーターとミドルウェア合成）

表面的なルーティング構文の裏側で、Hono はエッジ環境の厳しいリソース制約に耐えうる高度な最適化を施している。ルーターエンジンの切り替えメカニズムと、多層ミドルウェアを単一の非同期関数へと平坦化する合成構造を解き明かす。

## 最適化ルーターの自動選択

Hono は `SmartRouter` という統括層を持ち、登録されたルートの特性に応じて最適なルーティングエンジンを自動選択する。

- **RegExpRouter**: 登録された全パスを 1 つの大きな正規表現にして、1 回のマッチで対象ハンドラを特定する。Hono の公式ドキュメントは、これを JavaScript で最速のルーターとしている。ただし全パターンには対応しないため、通常は他のルーターと組み合わせて使う。
- **TrieRouter**: `/` で区切ったセグメントごとにトライ木をたどる。すべてのパターンに対応するので、RegExpRouter が扱えないルートがあるときのフォールバックになる。

マッチングの優先順位は登録順である。合致したハンドラとミドルウェアは登録した順に実行され、`Response` を返したところで止まる。したがって `/users/:id` を先に登録すると、`/users/me` へのリクエストもそちらのハンドラで処理されるので、特殊なパスは先に登録する。SmartRouter が決めるのは、照合に使うルーターだけである。最初のマッチ時に、全ルートを登録できる最初のルーター（RegExpRouter、登録できなければ TrieRouter）に決まる。

## ミドルウェアの合成メカニズム

ミドルウェアチェーンの実体は、関数型プログラミングにおける関数合成（Composition）である。登録された多段階のハンドラ群は、リクエスト処理開始時に `compose()` 処理を経て、1 本のネストした非同期コールバックへと畳み込まれる。

```ts
const timing = async (c, next) => {
  const start = performance.now(); // Workers では I/O の後にしか進まない
  await next(); // 次のミドルウェアまたは最終ハンドラへ処理を移譲
  const elapsed = performance.now() - start;
  c.header("server-timing", `work;dur=${elapsed}`);
};
```

- 下流のハンドラやミドルウェアが例外を投げても、Hono が捕まえて `app.onError()` に渡す（なければ 500 にする）。このため `await next()` は例外を投げず、`try / finally` で囲む必要はない。捕まえた例外は `c.error` で読める。
- `c.set(key, value)` と `c.get(key)` を用いることで、認証ミドルウェアで復号したユーザー情報などを後続のハンドラへ安全に伝達できる。このコンテキスト変数には TypeScript のジェネリクスで厳密な型を適用できる。

## ストリーミング伝送の制御

大規模言語モデルの逐次出力のように、できた分から順に送りたいときは、`hono/streaming` のストリーミングヘルパーを使う。

```ts
import { streamSSE, streamText } from "hono/streaming";

// テキストチャンクのストリーミング
return streamText(c, async (stream) => {
  for (const token of textTokens) {
    await stream.write(token);
    await stream.sleep(20);
  }
});

// Server-Sent Events（SSE）の送出
return streamSSE(c, async (stream) => {
  await stream.writeSSE({ data: JSON.stringify({ event: "ping" }) });
});
```

ストリームの内部で `stream.onAbort()` にコールバックを登録しておけば、クライアントがブラウザのタブを閉じるなどして通信を切断したときに、上流 API の呼び出しや計算を止める処理を実行できる。
