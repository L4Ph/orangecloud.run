# Python

Workers 并不只支持 JavaScript。使用 **Python Workers** 可以在同一个 isolate 里运行 Python。

## 形态

```python
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.json({"hello": "python"})
```

- `Default` 类的 `fetch` 是入口，对应 JavaScript 的 `export default { fetch }`
- `Response` 是标准响应对象，`Response.json()` 返回 JSON
- 绑定和环境变量通过 `self.env` 访问（如 `self.env.KV`）

## 运行

Worker 配置需要兼容标志。

```jsonc
{ "compatibility_flags": ["python_workers"] }
```

本地用 `npx wrangler dev`，部署用 `npx wrangler deploy`。本站编辑器在执行时会带上同样的标志。

## 适合与不适合

- 适合：数据整理、文本处理、移植已有 Python 逻辑、AI 结果后处理
- 不适合：重型科学计算、原生扩展、数 GB 数据。包的限制类似 Pyodide，`numpy` 也许能跑但很慢。确实需要时用 Containers

## 日志

`print()` 输出到 Workers 日志（tail），不会出现在本站的响应里。想看的值请放进 `Response.json()`。
