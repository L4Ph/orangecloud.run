# 在 Containers 中运行 Shell

在容器中可以使用 `sh` 以及镜像里包含的任意二进制程序。本站的镜像里只装有 Node.js 和 Python，并没有安装 `ffmpeg` 和 ImageMagick。

运行环境的镜像由 `Dockerfile.sandbox` 决定。如果自行部署这个仓库，请把想使用的命令添加到 `apt-get install` 中。
