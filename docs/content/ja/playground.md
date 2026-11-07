# 学習環境のアーキテクチャ（Dynamic Workers）

ブラウザ上でユーザーが書いた任意のコードを安全に実行するサンドボックスを構築しようとすると、従来は重厚な Docker コンテナをバックエンドで回すのが定番だった。だがコンテナ方式では、1 回の実行ごとに数秒の起動遅延が生じ、サーバーインスタンスの維持費もかさむ。

この学習環境では、コンテナを一切使わずに **Dynamic Workers（Worker Loader バインディング）** を採用している。親の Worker が受信したリクエストに応じて、オンデマンドで子の V8 isolate をメモリ上に構築し、ミリ秒単位で使い捨てる。

## 動的 Worker の構築と起動

親 Worker は、ユーザーから送られてきたコードをモジュールとして束ね、`env.LOADER` を通じて子 Worker をインスタンス化する。

```ts
const worker = env.LOADER.get(`sandbox-${hash(code)}`, () => ({
  compatibilityDate: "2026-02-24",
  mainModule: "index.js",
  modules: { "index.js": wrapUserCode(code) },
  env: {
    KV: ctx.exports.LessonKv({ props: { prefix: "playground/" } }),
    DB: ctx.exports.LessonDb({ props: {} }),
  },
  globalOutbound: null, // 外部ネットワークへの全外向き通信を遮断
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **`globalOutbound: null` による完全隔離**: 子 Worker の内部からは、インターネット上の任意サーバーへ向けた `fetch()` や Raw ソケットの確立が一切できない。悪意あるスクリプトによる不正な外部通信やクレデンシャルの持ち出しを物理的に封じる。
- **厳密なリソース上限**: CPU 実行時間を最大 100ms に制限する。無限ループや過剰な演算を含むコードが投入されても、親 Worker のリソースを枯渇させることなく子 isolate だけが打ち切られる。
- **isolate のキャッシュ再利用**: `env.LOADER.get(id, factory)` を用い、同一コード（ハッシュ値が一致するコード）に対しては既存の isolate を再利用する。無駄なメモリ再割り当てを防ぎ、コストとレイテンシを最小化する。

## バインディングの注入境界

子 Worker の `env` に載せられるのは、構造化クローン（Structured Clone）が可能なデータ型と Service Binding の2種類だけである。D1、KV、R2、AI、Durable Object のスタブは、どちらにも当たらないので、直接は渡せない。`env` に載せると、デプロイ先の実行環境では `This ServiceStub cannot be serialized.` で失敗する。

そこで親 Worker は、バインディングごとに `WorkerEntrypoint` のクラスを export し、そのスタブ（`ctx.exports.LessonKv({ props })`）を子に渡す。子は `env.KV.get()` のように普通のバインディングとして呼べる。呼び出しは親への RPC になり、親が本物のリソースに対して実行する。クラスは `lib/lesson-bindings.ts` にある。

| リソース        | 子 Worker が受け取るもの                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------- |
| KV / R2         | `LessonKv` / `LessonR2`。キーは `props.prefix` の下に閉じ込めるので、アプリ側の他のキーには触れない |
| D1 データベース | `LessonDb`。`prepare(sql).bind(...).run()` の連鎖は、順にスタブを返す                               |
| Workers AI      | `LessonAi`。呼び出しごとに課金されるので、授業のモデル1つと小さな入力に限る                         |
| Durable Objects | `LessonCounter`。Durable Object へ中継するスタブ                                                    |

子に見えるのはこの5つのスタブだけで、親の `env` や `ctx`、クラスに書いていないメソッドには届かない。呼び出し1回はサブリクエスト1回と数え、1回の実行あたり 20 回までに制限する。

## マルチテナント実行の防衛ライン

1. **暗黙のキャッシュ汚染防止**: コード内の空白や改行を正規化した上でハッシュ値を計算し、意図しないキャッシュ分裂を防ぐ。
2. **レートリミットによる過負荷の防止**: 実行エンドポイントの呼び出し回数をクライアント IP ごとに制限し（コンテナはさらに厳しくする）、自動化スクリプトによる過負荷攻撃を防ぐ。上限は Cloudflare のロケーションごとに数えるおおよその値である。
3. **コスト防壁**: Dynamic Workers は「1 日に生成されたユニークな Worker 数」に応じて課金される。教材コードの初期状態を多くのユーザーが共有することで、課金対象のユニーク Worker 数を最小限に抑え込む設計をとっている。
