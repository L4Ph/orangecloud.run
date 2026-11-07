# 学習環境のアーキテクチャ（Dynamic Workers）

ブラウザ上でユーザーが書いた任意のコードを安全に実行するサンドボックスを構築しようとすると、従来は重厚な Docker コンテナをバックエンドで回すのが定番だった。だがコンテナ方式では、1 回の実行ごとに数秒の起動遅延が生じ、サーバーインスタンスの維持費もかさむ。

この学習環境では、コンテナを一切使わずに **Dynamic Workers（Worker Loader バインディング）** を採用している。親の Worker が受信したリクエストに応じて、オンデマンドで子の V8 isolate をメモリ上に構築し、ミリ秒単位で使い捨てる。

## 動的 Worker の構築と起動

親 Worker は、ユーザーから送られてきたコードをモジュールとして束ね、`env.LOADER` を通じて子 Worker をインスタンス化する。

```ts
const worker = env.LOADER.get(`sandbox-${hash(code)}`, () => ({
  compatibilityDate: '2026-02-24',
  mainModule: 'index.js',
  modules: { 'index.js': wrapUserCode(code) },
  env: { KV: kvProxyStub, DB: env.DB },
  globalOutbound: null, // 外部ネットワークへの全外向き通信を遮断
  limits: { cpuMs: 100, subRequests: 0 },
}));

const response = await worker.getEntrypoint().fetch(new Request('https://sandbox.internal/'));
```

- **`globalOutbound: null` による完全隔離**: 子 Worker の内部からは、インターネット上の任意サーバーへ向けた `fetch()` や Raw ソケットの確立が一切できない。悪意あるスクリプトによる不正な外部通信やクレデンシャルの持ち出しを物理的に封じる。
- **厳密なリソース上限**: CPU 実行時間を最大 100ms に制限する。無限ループや過剰な演算を含むコードが投入されても、親 Worker のリソースを枯渇させることなく子 isolate だけが打ち切られる。
- **isolate のキャッシュ再利用**: `env.LOADER.get(id, factory)` を用い、同一コード（ハッシュ値が一致するコード）に対しては既存の isolate を再利用する。無駄なメモリ再割り当てを防ぎ、コストとレイテンシを最小化する。

## バインディングの注入境界

子 Worker の `env` に直接渡すことができるオブジェクトには制限がある。構造化クローン（Structured Clone）が可能なデータ型、および Service Binding に限られる。

| リソース | 子 Worker への渡し方 |
| --- | --- |
| D1 データベース | ネイティブで構造化クローンに対応しているため、そのまま引き渡す |
| Durable Objects | `namespace.get(id)` で取得したスタブオブジェクト（Service Binding）として渡す |
| KV / R2 / AI | 名前空間そのものは直接クローンできないため、親側で Durable Object や Service Binding の RPC プロキシを介して中継する |

たとえば KV の場合、親環境に配置した Durable Object が `get` / `put` / `delete` / `list` のハンドラを受け持ち、その RPC スタブを子環境へ `env.KV` として注入する。子 Worker 内部のコードからは、本物の KV 名前空間と全く同一のインターフェースとして透過的に利用できる。

## マルチテナント実行の防衛ライン

1. **暗黙のキャッシュ汚染防止**: コード内の空白や改行を正規化した上でハッシュ値を計算し、意図しないキャッシュ分裂を防ぐ。
2. **Turnstile によるボット遮断**: 実行エンドポイントの前段で Cloudflare Turnstile を検証し、自動化スクリプトによる過負荷攻撃を防ぐ。
3. **コスト防壁**: Dynamic Workers は「1 日に生成されたユニークな Worker 数」に応じて課金される。教材コードの初期状態を多くのユーザーが共有することで、課金対象のユニーク Worker 数を最小限に抑え込む設計をとっている。
