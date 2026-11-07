# Python Workers

エッジ環境で Python スクリプトを動かす試みは、長らく難題であり続けた。Docker コンテナを起動しようとすれば数秒のコールドスタートを強いられ、仮想マシンのメモリ消費に頭を抱える。一方で、データ処理やテキスト解析、機械学習の接着コードは、依然として Python で書くのが最も自然である。

Cloudflare の **Python Workers** は、この溝を埋めるアプローチをとる。コンテナを立ち上げるのではなく、V8 isolate の内部で WebAssembly にコンパイルされた Python 実行基盤（Pyodide）を直接起動する。JavaScript の Workers と全く同じ俊敏さで、数ミリ秒のコールドスタートを維持したまま Python コードが走り始める。

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

## 適用領域の境界線

- **強みを発揮する領域**: JSON データの変換、正規表現を用いた高度なテキスト整形、既存の Python 製ビジネスロジックの移植、LLM から受け取った出力の後処理。
- **避けるべき領域**: ギガバイト単位の大規模データセットの解析、C 言語によるネイティブ拡張モジュールを要求する重厚な科学計算。パッケージは WebAssembly 上で動作可能なものに限られ、重厚なネイティブライブラリは初期化や実行速度の面で不利に働く。OS レベルの完全な環境が必要な場合は、コンテナ実行環境（Containers）を選択すべきである。

実行時の `print()` 出力はプラットフォームの監視ログ（Tail）へと流れる。ブラウザへ即座に結果を返したい変数は、`Response.json()` のレスポンスペイロードに含めて返すのが確実である。
