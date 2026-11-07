# Containers でシェルを動かす

コンテナの中では `sh` と、イメージに入っている任意のバイナリが使える。このサイトのイメージには Node.js と Python が入っているだけで、`ffmpeg` や ImageMagick は入っていない。

実行環境のイメージは `Dockerfile.sandbox` で決まる。このリポジトリを自分でデプロイする場合は、使いたいコマンドを `apt-get install` に足す。
