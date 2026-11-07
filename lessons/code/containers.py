import os
import platform

# コンテナのシステム情報を確認 / Inspect container system information
print("python", platform.python_version())
print("cwd", os.getcwd())
print("sum(1..100) =", sum(range(1, 101)))
print("node present:", os.path.exists("/usr/local/bin/node"))
