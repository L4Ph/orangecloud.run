# Cloudflare Workers を動かして学ぶ

チュートリアル兼プレイグラウンド。左のエディタに Worker のコードを書き、「実行」を押すと**リクエストごとに新しい Worker（Dynamic Workers）**として走ります。ネットワークは塞がれ、CPU は 100ms で打ち切られるので、何を書いても共有環境は壊れません。

## 起動

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # Vite+ の fmt / lint（type-aware + type check）をまとめて実行
npm run lint       # Oxlint のみ
npm run fmt        # Oxfmt のみ
npm run smoke      # 動いている開発サーバーに対して全単元のコードを実行
npm run i18n:extract  # 文言を抽出して .po を更新
```

## 言語

日本語 / English / 简体中文 / 한국어。`hono/language` で `?lang=` → Cookie → `Accept-Language` の順に判定し、SSR 時にその言語のカタログを読みます。ヘッダーのセレクタで切り替えると `?lang=` 付きで再読み込みし、Cookie に残ります。

- UI 文言: Lingui（`lingui({ macroTransform: true })` の native macro transform）+ `locales/{locale}/messages.po`
- 章の本文: `lessons/docs/{locale}/{id}.md`（無い言語は日本語にフォールバック）
- 文言の追加・変更: `npm run i18n:extract` → `.po` を埋める

## ボット対策（Turnstile）

`/api/run` は Turnstile のトークンが無いと実行しません（widget の sitekey は `lib/turnstile.tsx`）。

- 本番: ダッシュボードで widget の secret を確認し `void secret put TURNSTILE_SECRET`
- siteverify は `action === 'run'` と、リクエストのホスト名と一致する `hostname` を確認
- 検証に通ると署名付き Cookie（`run_pass`、12時間、HttpOnly）を発行し、以降は widget なしで実行できる。初回だけ Turnstile が動く
- ローカルは `.env` の `TURNSTILE_SECRET`（本番と同じ widget の secret）で検証する
- 公開するドメインを widget のドメイン一覧に追加するのを忘れない

## UI

コンポーネントは Cloudflare の [Kumo UI](https://kumo-ui.com/)（`@cloudflare/kumo`）、スタイルは Tailwind v4。`pages/app.css` は Tailwind の読み込みと Kumo のトークン登録だけで、独自 CSS はありません。本文（Markdown）は `@tailwindcss/typography` の `prose` に Kumo トークンを当てています。ダークモードは `<html data-mode>` を matchMedia で切り替え（初回描画前に head のスクリプトで設定）。

## ツールチェーン

Vite+（`vp`）の `check` を使います。設定は `vite.config.ts` の `lint` / `fmt` ブロックに集約し、`lint.options.typeAware` と `typeCheck` を有効にしています。

## 構成

- **Void（Vite+）**: ルーティング・SSR・Cloudflare へのデプロイ
- **`routes/api/run.ts`**: Turnstile を検証してから `env.LOADER`（Worker Loader バインディング）でサンドボックス Worker を起動
- **`pages/index.server.ts`**: ロケール・章・本文 HTML を loader で返す（章は `?lesson=kv`、`head()` で `<html lang>`）
- **`lib/turnstile.tsx`**: widget の描画（実行ごとに作り直して単発トークンを取り直す）
- **`env.ts`**: `TURNSTILE_SECRET` のスキーマ（ローカルは `.env`、本番は `void secret put`）
- **`routes/api/sandbox.dev.ts`**: 開発専用の検証なし実行口（smoke 用。ビルド対象外）
- **`lessons/`**: 単元データ（`lessons/docs/{locale}/*.md`、`lessons/code/*.js` はそのまま実行される）
- **`lib/locales.ts`**: 対応言語の定義（唯一の出典）
- **`middleware/01.language.ts`**: hono/language による言語判定と Cookie 保存
- **`pages/index.tsx`**: 左 Monaco エディタ / 右 資料
- **`durable-objects/`**:
  - `lesson-kv` / `lesson-r2` / `lesson-ai` — isolate に渡せないバインディングの中継
  - `lesson-counter` — Durable Objects 単元で使う本物の DO

## 実行モデル

| バインディング                      | サンドボックスへの渡し方                              |
| ----------------------------------- | ----------------------------------------------------- |
| `env.DB`（D1）                      | そのまま（structured clone 可能）                     |
| `env.KV` / `env.STORAGE` / `env.AI` | Durable Object 経由の RPC（namespace 自体は渡せない） |
| `env.COUNTER`                       | 本物の Durable Object スタブ                          |

サンドボックスのキャッシュ ID は `run-<WRAPPER_VERSION>-<hash(code)>`。同じコードの再実行は isolate を再利用し、Dynamic Workers の課金（ユニーク数）を増やしません。`WRAPPER_VERSION` は `routes/api/run.ts` のラッパーを変えたら上げてください。

## 注意

- 認証はありません。公開する場合はレート制限を前段に置いてください。
- Workers AI はローカルで動きません（`void cloudflare login` が必要）。
- Workers 有料プランが前提です（Dynamic Workers）。
