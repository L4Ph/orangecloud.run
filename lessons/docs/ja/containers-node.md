# Containers で Node.js を動かす

isolate では `fs` も `child_process` も使えない。コンテナは通常の Linux なので、Node.js の標準ライブラリがそのまま動く。

エディタのコードはファイルを書き、`uname` を子プロセスで呼ぶ。Dynamic Worker で同じコードを走らせると失敗する。
