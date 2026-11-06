# デプロイまで

ローカルで動いたら、最後は自分のアカウントへ出します。

## 手順

```sh
# 1. Cloudflare にログイン（ブラウザが開く）
npx void cloudflare login

# 2. 本番の秘密値を登録（.env はアップロードされない）
npx void secret put MY_API_KEY

# 3. デプロイ（初回はアカウントとリソースを選ぶ）
npx void deploy --platform cloudflare
```

初回は D1 などのリソースが自動作成され、`void.lock.json` に記録されます。**このファイルはコミットしてください。** マイグレーションの履歴が入っています。

## デプロイ前に確認すること

- [ ] 秘密情報は `env.ts` のスキーマ + `void secret put`。コードに直書きしない
- [ ] `env.DB` などのバインディング名が本番でも同じか
- [ ] 無限ループしないか（CPU 制限で殺されるが、その間リクエストは失敗する）
- [ ] 想定外に大きいレスポンスを返していないか
- [ ] 課金が読める状態か（ダッシュボードの Usage を見る）

## 公開したあと

- 独自ドメインを付ける（Workers の Custom Domain）
- ログを見る（`cf` CLI かダッシュボード。`wrangler tail` 相当）
- アクセスが増えたらキャッシュ（Cache API / 静的アセット）を入れる

## この教材自体の構成

このサイトは **Void（Vite+）+ Cloudflare Workers** で動いています。左のエディタのコードは、リクエストごとに **Dynamic Workers**（実行時に Worker を 1 個作る仕組み）で実行され、ネットワークを塞がれた状態で走ります。だから何を書いても壊れません。

- 実行基盤: `env.LOADER`（Worker Loader バインディング）
- 実行ごとの制限: CPU 100ms、外向き通信なし
- KV / R2 / AI は Durable Object 経由で中継（isolate には渡せないため）
- D1 と Durable Objects は本物のバインディングを直接渡している
