# Python Workers

在边缘环境中运行 Python 脚本长期以来一直是一项难题。尝试启动 Docker 容器会导致数秒的冷启动，而虚拟机的内存消耗则令人头疼。另一方面，数据处理、文本分析和机器学习的胶水代码，依然最自然地用 Python 来编写。

Cloudflare 的 **Python Workers** 采用了填补这一鸿沟的方法。它并非启动容器，而是在 V8 isolate 内部直接启动编译为 WebAssembly 的 Python 执行平台（Pyodide）。部署时会为已初始化的内存生成快照，并在收到请求时恢复该快照，以加快启动。即便如此，冷启动仍比 JavaScript Worker 更重：在 Cloudflare 的测量（2025 年 12 月）中，导入 FastAPI、httpx 和 pydantic 的 Worker 平均耗时 1.027 秒。

## 语法结构与入口点

```python
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.json({"runtime": "python", "status": "ok"})
```

- 继承自 `WorkerEntrypoint` 的 `Default` 类的 `fetch` 方法成为请求的接收端。这在 JavaScript 中起到了与 `export default { fetch }` 完全相同的作用。
- `Response` 类符合 Web 标准的 HTTP 响应规范，可通过 `Response.json()` 直观地返回 JSON 数据。
- 对 KV 或 D1 等 Cloudflare 资源的访问通过实例变量 `self.env` 透明地实现。
- 要运行它，需要在 Worker 的配置中启用兼容性标志 `python_workers`。

## 适用领域的界限

- **发挥优势的领域**：JSON 数据转换、使用正则表达式的高级文本格式化、现有 Python 业务逻辑的移植、LLM 接收输出的后处理。
- **应避免的领域**：超出 isolate 128MB 内存上限的大数据处理、线程与多进程（`threading` 和 `multiprocessing` 可以导入，但无法正常工作），以及没有 WebAssembly 构建的原生扩展包。numpy、pandas、scipy 由 Pyodide 提供了 Wasm 构建，因此不能仅因为带有原生扩展就回避它们。如果需要完整的操作系统级环境，应选择容器运行环境（Containers）。

运行时的 `print()` 输出会流向平台的监控日志（Tail）。对于需要立即将结果返回给浏览器的变量，最稳妥的做法是将其包含在 `Response.json()` 的响应有效载荷中返回。
