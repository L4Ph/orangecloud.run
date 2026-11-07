# Python

Workers は JavaScript だけの場所ではありません。**Python Workers** を使うと同じ実行環境（isolate）のまま Python が動きます。

## 形

```python
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.json({"hello": "python"})
```

- `Default` クラスの `fetch` がエントリポイント。JavaScript の `export default { fetch }` と同じ役割
- `Response` は Web 標準のレスポンス。`Response.json()` で JSON を返せる
- 環境変数やバインディングは `self.env` から触れる（`self.env.KV` など）

## 動かすには

Worker の設定に互換フラグが必要です。

```jsonc
{ "compatibility_flags": ["python_workers"] }
```

ローカルでは `npx wrangler dev`、デプロイは `npx wrangler deploy`。このサイトのエディタでは、実行時に同じフラグを付けて動かしています。

## 向き不向き

- 向く：データ整形、テキスト処理、既存の Python ロジックの移植、AI の後処理
- 向かない：重い科学計算、ネイティブ拡張、数 GB のデータ。パッケージは Pyodide 相当の制約があり、`numpy` などは動いても遅い。本気で必要なときは Containers

## ログ

`print()` は Workers のログ（tail）に出ます。このサイトのレスポンスには含まれないので、確認したい値は `Response.json()` に詰めて返してください。
