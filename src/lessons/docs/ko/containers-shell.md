# Containers에서 셸 실행하기

컨테이너 안에서는 `sh`와 이미지에 들어 있는 임의의 바이너리를 사용할 수 있다. 이 사이트의 이미지에는 Node.js와 Python만 들어 있고, `ffmpeg`나 ImageMagick은 들어 있지 않다.

실행 환경의 이미지는 `Dockerfile.sandbox`로 정해진다. 이 저장소를 직접 배포하는 경우에는 사용하고 싶은 명령어를 `apt-get install`에 추가한다.
