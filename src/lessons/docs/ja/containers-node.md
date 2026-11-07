# Containers で Node.js を動かす

isolate では `child_process` が使えない。`fs` も、リクエストごとに用意されるメモリ上の仮想ファイルシステムに限られ、`/tmp` に書いたファイルはリクエストをまたいで残らない。コンテナは通常の Linux なので、実際のファイルシステムも `child_process` もそのまま動く。

エディタのコードはファイルを書き、`uname` を子プロセスで呼ぶ。Dynamic Worker で同じコードを走らせると失敗する。
