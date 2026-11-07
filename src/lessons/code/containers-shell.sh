# 任意の Linux コマンドをパイプでつなぐ / Pipe any Linux commands together
uname -sr
echo "one two three" | tr ' ' '\n' | sort -r
ls /usr/local/bin | head -5
echo "node: $(node --version), python: $(python3 --version)"
