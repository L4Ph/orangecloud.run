# デプロイまで

ローカルで動いたら、Cloudflare のアカウントへ出します。ここでは公式 CLI の Wrangler を使います。

## 手順

```sh
# 1. ログイン（ブラウザが開く）
npx wrangler login

# 2. ローカルで確認
npx wrangler dev

# 3. デプロイ
npx wrangler deploy
```

新規プロジェクトなら `npm create cloudflare@latest` でテンプレートから始めるのが早いです。

## 秘密値とリソース

```sh
# API キーなどはコードに書かず、Worker のシークレットに入れる
npx wrangler secret put API_KEY

# D1 データベース
npx wrangler d1 create my-db
npx wrangler d1 migrations apply my-db --remote

# KV / R2 / Queue も create コマンドで作り、wrangler.jsonc に binding を書く
```

バインディングは `wrangler.jsonc` に定義します。ローカルでは Miniflare が同じ設定を読むので、コードは本番と同じ `env.DB` などで動きます。

## デプロイ前に確認すること

- [ ] 秘密情報は `wrangler secret put`。コードや `vars` に直書きしない
- [ ] バインディング名が本番でも同じか（`wrangler.jsonc`）
- [ ] 無限ループしないか（CPU 制限で殺されるが、その間のリクエストは失敗する）
- [ ] 想定外に大きいレスポンスを返していないか
- [ ] 課金が読める状態か（ダッシュボードの Usage）

## 公開したあと

- 独自ドメインを付ける（Workers の Custom Domain）
- ログを見る：`npx wrangler tail`
- アクセスが増えたらキャッシュ（Cache API / 静的アセット）を入れる
