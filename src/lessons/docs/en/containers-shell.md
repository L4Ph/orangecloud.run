# Run shell scripts in Containers

Inside a container you can use `sh` and any binary included in the image. The image on this site only has Node.js and Python in it; `ffmpeg` and ImageMagick are not installed.

The execution environment is defined by `Dockerfile.sandbox`. If you deploy this repository yourself, add the commands you want to `apt-get install`.
