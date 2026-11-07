# Python Workers

エッジ環境で Python スクリプトを動かす試みは、長らく難題であり続けた。Docker コンテナを起動しようとすれば数秒のコールドスタートを強いられ、仮想マシンのメモリ消費に頭を抱える。一方で、データ処理やテキスト解析、機械学習の接着コードは、依然として Python で書くのが最も自然である。

Cloudflare の **Python Workers** は、この溝を埋めるアプローチをとる。コンテナを立ち上げるのではなく、V8 isolate の内部で WebAssembly にコンパイルされた Python 実行基盤（Pyodide）を直接起動する。デプロイ時に初期化済みのメモリのスナップショットを取り、リクエスト時に復元して起動を速めている。それでも JavaScript の Worker よりコールドスタートは重く、Cloudflare の計測（2025 年 12 月）では FastAPI・httpx・pydantic を import する Worker で平均 1.027 秒だった。

## 構文構造とエントリポイント

```python
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.json({"runtime": "python", "status": "ok"})
```

- `WorkerEntrypoint` を継承した `Default` クラスの `fetch` メソッドがリクエストの受信口となる。これは JavaScript における `export default { fetch }` と全く同じ役割を果たす。
- `Response` クラスは Web 標準の HTTP レスポンス仕様に準拠しており、`Response.json()` を介して直感的に JSON データを返却できる。
- KV や D1 などの Cloudflare リソースへのアクセスは、インスタンス変数 `self.env` を通じて透過的に行われる。
- 動かすには、Worker の設定で互換性フラグ `python_workers` を有効にする。

## 適用領域の境界線

- **強みを発揮する領域**: JSON データの変換、正規表現を用いた高度なテキスト整形、既存の Python 製ビジネスロジックの移植、LLM から受け取った出力の後処理。
- **避けるべき領域**: isolate のメモリ上限（128MB）に収まらない大きなデータの処理、スレッドやマルチプロセス（`threading` と `multiprocessing` は import できても動かない）、WebAssembly 版のないネイティブ拡張を持つパッケージ。numpy・pandas・scipy は Pyodide が Wasm 版を提供しているので、ネイティブ拡張を持つというだけでは避ける理由にならない。OS レベルの完全な環境が必要な場合は、コンテナ実行環境（Containers）を選択すべきである。

実行時の `print()` 出力はプラットフォームの監視ログ（Tail）へと流れる。ブラウザへ即座に結果を返したい変数は、`Response.json()` のレスポンスペイロードに含めて返すのが確実である。
