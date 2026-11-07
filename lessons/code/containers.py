import os
import platform

print("python", platform.python_version())
print("cwd", os.getcwd())
print("sum(1..100) =", sum(range(1, 101)))
print("node present:", os.path.exists("/usr/local/bin/node"))
