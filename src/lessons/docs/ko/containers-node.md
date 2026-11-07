# Containers에서 Node.js 실행하기

isolate에서는 `child_process`를 사용할 수 없다. `fs`도 요청마다 준비되는 메모리상의 가상 파일 시스템으로 한정되며, `/tmp`에 쓴 파일은 요청을 넘어서 남지 않는다. 컨테이너는 일반적인 Linux이므로 실제 파일 시스템도 `child_process`도 그대로 동작한다.

에디터의 코드는 파일을 쓰고 `uname`을 자식 프로세스로 호출한다. Dynamic Worker에서 같은 코드를 실행하면 실패한다.
