# 学習環境のアーキテクチャ（Dynamic Workers）

ブラウザ上でユーザーが書いた任意のコードを安全に実行するサンドボックスを構築しようとすると、従来は重厚な Docker コンテナをバックエンドで回すのが定番だった。だがコンテナ方式では、1 回の実行ごとに数秒の起動遅延が生じ、サーバーインスタンスの維持費もかさむ。

この学習環境の JavaScript と Python のレッスンは、コンテナを使わずに **Dynamic Workers（Worker Loader バインディング）** で動かす。親の Worker が受信したリクエストに応じて、オンデマンドで子の V8 isolate をメモリ上に構築し、ミリ秒単位で使い捨てる。Containers の各章と、Durable Object を自分で書く章は、コンテナと Durable Object という別のランタイムで動かす。

## 動的 Worker の構築と起動

親 Worker は、ユーザーから送られてきたコードを、結果を常に JSON で返すラッパーとともにモジュールとして束ね、`env.LOADER` を通じて子 Worker をインスタンス化する。

```ts
import { exports } from "cloudflare:workers";

// ID は、ラッパーのバージョンと、正規化したコードの SHA-256（先頭 128 ビット）から作る
const id = `run-${WRAPPER_VERSION}-${await hash(normalize(code))}`;
const worker = env.LOADER.get(id, () => ({
  compatibilityDate: "2026-02-24",
  mainModule: "index.js",
  modules: { "index.js": wrapped, "user.js": code },
  env: {
    KV: exports.LessonKv({ props: { prefix: "playground/" } }),
    STORAGE: exports.LessonR2({ props: { prefix: "playground/" } }),
    AI: exports.LessonAi({ props: {} }),
    COUNTER: exports.LessonCounter({ props: {} }),
    DB: exports.LessonDb({ props: {} }),
  },
  globalOutbound: null, // 外部ネットワークへの全外向き通信を遮断
  limits: { cpuMs: 100, subRequests: 20 },
}));

const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));
```

- **`globalOutbound: null` によるネットワークの遮断**: 子 Worker からの `fetch()` と `connect()`（TCP 接続）はどちらも例外になる。外部との通信路は親が渡した 5 つのスタブだけなので、悪意あるスクリプトによる不正な外部通信を防げる。
- **リソース上限**: CPU 実行時間を最大 100ms に制限する。無限ループや過剰な演算を含むコードが投入されても、上限に達した子 Worker はただちに例外を投げる。
- **isolate のキャッシュ再利用**: `env.LOADER.get(id, factory)` は ID で isolate をキャッシュする。同じ ID なら既存の isolate が再利用されることがあるが、保証はない。読み込み済みの Worker はコードを照合せずに再利用されるので、ID は正規化したコードの SHA-256（先頭 128 ビット）から作り、別のコードが同じ ID にならないようにする。
- **互換日付の固定**: このエディタの Worker は互換日付 2026-02-24、`nodejs_compat` なしで動くため、`process` は存在しない。

## バインディングの注入境界

子 Worker の `env` に載せられるのは、構造化クローン（Structured Clone）が可能なデータ型と Service Binding の2種類だけである。D1、KV、R2、AI、Durable Object のスタブは、どちらにも当たらないので、直接は渡せない。`env` に載せると `DataCloneError` で失敗する。

そこで親 Worker は、バインディングごとに `WorkerEntrypoint` のクラスを export し、そのスタブ（`exports.LessonKv({ props })`）を子に渡す。子は `env.KV.get()` のように普通のバインディングとして呼べる。呼び出しは親への RPC になり、親が本物のリソースに対して実行する。クラスは `src/lib/lesson-bindings.ts` にある。

| リソース        | 子 Worker が受け取るもの                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| KV / R2         | `LessonKv` / `LessonR2`。キーは `props.prefix` の下に閉じ込めるので、アプリ側の他のキーには触れない                                       |
| D1 データベース | `LessonDb`。`prepare(sql).bind(...).run()` の連鎖は、順にスタブを返す。プレフィックスによる区切りはなく、全員が同じデータベースを共有する |
| Workers AI      | `LessonAi`。呼び出しごとに課金されるので、授業のモデル1つと小さな入力に限る                                                               |
| Durable Objects | `LessonCounter`。Durable Object へ中継するスタブ。名前は固定で、全員が同じカウンターを共有する                                            |

子に見えるのはこの5つのスタブだけで、親の `env` や `ctx`、クラスに書いていないメソッドには届かない。Service Binding 経由の呼び出しはサブリクエストの上限に数えられるので、1回の実行あたり 20 回までに制限する。

## マルチテナント実行の防衛ライン

1. **キャッシュ分裂の防止**: CRLF を LF にそろえ、末尾の改行を取り除いてからハッシュ値を計算し、中身が同じコードが別の Worker として数えられるのを防ぐ。空白など、動作を変えうる違いは正規化しない。
2. **レートリミットによる過負荷の防止**: 実行エンドポイントの呼び出し回数をクライアント IP ごとに制限し（コンテナと Durable Object の実行はさらに厳しくする）、自動化スクリプトによる過負荷攻撃を防ぐ。上限は Cloudflare のロケーションごとに数えるおおよその値である。
3. **コストの抑制**: Dynamic Workers は、1 日に生成されたユニークな Worker（ID とコードの組）の数に加えて、リクエスト数と CPU 時間（起動時間を含む）で課金される。有料プランが要る。編集していない教材コードは全員が同じ Worker を使うので、ユニーク数は増えない。編集したコードは内容が変わるたびに新しい Worker になるので、IP ごとのレート制限が上限になる。
