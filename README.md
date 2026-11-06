# Cloudflare Workers を動かして学ぶ

チュートリアル兼プレイグラウンド。左のエディタに Worker のコードを書き、「実行」を押すと**リクエストごとに新しい Worker（Dynamic Workers）**として走ります。ネットワークは塞がれ、CPU は 100ms で打ち切られるので、何を書いても共有環境は壊れません。

## 起動

```sh
npm install
npm run dev        # http://localhost:5173
npm run smoke      # 動いている開発サーバーに対して全単元のコードを実行
```

## 構成

- **Void（Vite+）**: ルーティング・SSR・Cloudflare へのデプロイ
- **`routes/api/run.ts`**: `env.LOADER`（Worker Loader バインディング）でサンドボックス Worker を起動
- **`lessons/`**: 単元ごとの Markdown とコード（`lessons/code/*.js` はそのまま実行される）
- **`pages/index.tsx`**: 左 Monaco エディタ / 右 資料
- **`durable-objects/`**:
  - `lesson-kv` / `lesson-r2` / `lesson-ai` — isolate に渡せないバインディングの中継
  - `lesson-counter` — Durable Objects 単元で使う本物の DO

## 実行モデル

| バインディング | サンドボックスへの渡し方 |
| --- | --- |
| `env.DB`（D1） | そのまま（structured clone 可能） |
| `env.KV` / `env.STORAGE` / `env.AI` | Durable Object 経由の RPC（namespace 自体は渡せない） |
| `env.COUNTER` | 本物の Durable Object スタブ |

サンドボックスのキャッシュ ID は `run-<WRAPPER_VERSION>-<hash(code)>`。同じコードの再実行は isolate を再利用し、Dynamic Workers の課金（ユニーク数）を増やしません。`WRAPPER_VERSION` は `routes/api/run.ts` のラッパーを変えたら上げてください。

## 注意

- 認証はありません。公開する場合はレート制限を前段に置いてください。
- Workers AI はローカルで動きません（`void cloudflare login` が必要）。
- Workers 有料プランが前提です（Dynamic Workers）。
