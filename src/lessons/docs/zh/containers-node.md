# 在 Containers 中运行 Node.js

isolate 中无法使用 `child_process`。`fs` 也仅限于为每个请求准备的内存虚拟文件系统，写入 `/tmp` 的文件不会在请求之间保留。容器是普通的 Linux，因此真实的文件系统和 `child_process` 都可以直接使用。

编辑器中的代码会写入文件，并通过子进程调用 `uname`。在 Dynamic Worker 中运行同样的代码会失败。
