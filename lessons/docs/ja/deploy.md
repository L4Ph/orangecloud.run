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

## このサイトの仕組み

このサイトは Cloudflare Workers 上で動いています。左のエディタのコードは、リクエストごとに **Dynamic Workers**（実行時に Worker を 1 個作る仕組み）で実行され、ネットワークを塞がれた状態で走ります。だから何を書いても壊れません。

- 実行基盤: Worker Loader バインディング
- 実行ごとの制限: CPU 100ms、外向き通信なし
- KV / R2 / AI は Durable Object 経由で中継し、D1 と Durable Objects は本物のバインディングを直接渡している
