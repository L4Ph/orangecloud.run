# エッジへのデプロイと運用

ローカルのシミュレータ（Miniflare）で動作を確認したコードを、世界数百箇所のエッジデータセンターへ展開する。Cloudflare の公式 CLI である **cf**（ベータ）を通じて、設定ファイルとビルド成果物を世界規模のネットワークへ同期させる。cf はベータなので、コマンドや設定が変わりうる。Wrangler も使え、公式の入門ガイドは今も Wrangler を前提にしている。このサイトでは cf を使う。

## 開発とデプロイの基本サイクル

```sh
# 初回認証（ブラウザが起動しアカウント連携を行う）
cf auth login

# ローカルエミュレータによる動作確認（高速なフィードバック）
cf dev

# エッジネットワークへの本番デプロイ
cf deploy
```

新規プロジェクトは `cf init my-worker` で作る。`cloudflare.config.ts`、型定義、`dev` / `build` / `deploy` の各スクリプトが揃った状態で始まる。Wrangler の既存プロジェクトは `cf migrate` で `cloudflare.config.ts` へ変換できる。

## 機密情報と外部リソースの接続

コードベース内に API キーや署名用シークレットを直接コミットする行為は厳禁である。環境変数には「公開されても良い静的設定（`bindings.text()` / `bindings.json()`）」と「暗号化して保存すべき機密情報（`bindings.secret()` で宣言するシークレット）」の明確な境界が存在する。

```sh
# 暗号化シークレットの登録（ダッシュボード上でも値は隠蔽される）
cf workers secrets update STRIPE_API_KEY --worker my-worker --type secret_text --text <SECRET_VALUE>

# D1 を作るコマンドは説明文から探せる
cf cli search "create a D1 database"

# 本番マイグレーションの適用（cf はデータベース ID を取り、既定でリモートに適用する）
cf d1 migrations apply <DATABASE_ID>
```

`cf` で 1 件ずつ登録するには `cf workers secrets update` を使う。`wrangler secret put` と同じ API を呼ぶが、値を引数で渡すため、シェルの履歴に残る。値を標準入力から渡したいときは `npx wrangler secret put` を使う。デプロイと一緒にまとめて渡すなら `cf deploy --secrets-file <PATH>`（JSON か .env）を使う。.env の `$VAR` は展開されるので、`$` を含む値は `\$` と書く。

各種リソースへの接続設定はプロジェクトルートの `cloudflare.config.ts` に型付きで記述する（`bindings.d1()` などのビルダーを使う）。ローカル開発時もこの定義を読むため、本番と同じ `env.DB` や `env.KV` のインターフェースで開発を継続できる。

## デプロイ前に検証すべき境界線

- **シークレットの分離**: API トークンや秘密鍵が、`cloudflare.config.ts` の `bindings.text()` / `bindings.json()` やソースコードに平文で残っていないか。
- **バインディング名の完全一致**: ソースコード上で参照している `env` プロパティ名と、`cloudflare.config.ts` の `env` に書いたキー名に差異がないか。
- **CPU 制限時間の考慮**: 外部データ処理や重厚なループ処理が、プランの制限時間（無料枠 10ms、有料枠は既定 30 秒で最大 5 分）を超過して強制終了を招く恐れはないか。
- **テールログによる監視体制**: デプロイ直後の実トラフィックの挙動は、エッジからの標準出力ログをリアルタイムに監視して確かめる。`cf` はまだ対応していないため、`npx wrangler tail <WORKER_NAME>` を使う。
