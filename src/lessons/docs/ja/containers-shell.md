# Containers でシェルを動かす

コンテナの中では `sh` と任意のバイナリが使える。FFmpeg や ImageMagick を呼ぶ処理も、この形にコマンドを並べるだけで始められる。

実行環境のイメージは `Dockerfile.sandbox` で決まる。入れたいコマンドは `apt-get install` に足す。
