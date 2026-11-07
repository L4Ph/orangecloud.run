# Run Node.js in Containers

An isolate cannot use `child_process`. `fs` is also limited to a virtual in-memory file system prepared for each request, and files written to `/tmp` do not persist across requests. A container is ordinary Linux, so a real file system and `child_process` both work as they are.

The code in the editor writes a file and calls `uname` in a child process. Running the same code in a Dynamic Worker fails.
