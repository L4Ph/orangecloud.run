# Python Workers

Attempting to run Python scripts in edge environments has long been a formidable challenge. Attempting to launch a Docker container forces a several-second cold start, and memory consumption in virtual machines becomes a headache. Meanwhile, glue code for data processing, text analysis, and machine learning remains most naturally written in Python.

Cloudflare's **Python Workers** takes an approach that bridges this gap. Rather than spinning up a container, it directly launches a Python execution platform (Pyodide) compiled to WebAssembly inside a V8 isolate. A snapshot of the initialized memory is taken at deploy time and restored on each request to speed up startup. Even so, the cold start is heavier than for a JavaScript Worker: in Cloudflare's measurement (December 2025), a Worker importing FastAPI, httpx, and pydantic averaged 1.027 seconds.

## Syntax Structure and Entry Points

```python
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.json({"runtime": "python", "status": "ok"})
```

- The `fetch` method of the `Default` class, which inherits from `WorkerEntrypoint`, serves as the request receiver. This performs the exact same role as `export default { fetch }` in JavaScript.
- The `Response` class conforms to Web standard HTTP response specifications, allowing it to intuitively return JSON data via `Response.json()`.
- Access to Cloudflare resources such as KV and D1 is handled transparently through the instance variable `self.env`.
- To run it, enable the compatibility flag `python_workers` in the Worker's configuration.

## Application Boundary

- **Areas where it excels**: JSON data transformation, advanced text formatting using regular expressions, porting existing Python business logic, and post-processing of outputs received from LLMs.
- **Areas to avoid**: Processing data too large for the isolate's 128MB memory limit, threads and multiprocessing (`threading` and `multiprocessing` can be imported but do not work), and packages with native extensions that have no WebAssembly build. numpy, pandas, and scipy are provided as Wasm builds by Pyodide, so native extensions alone are no reason to avoid them. If a complete OS-level environment is required, Containers should be chosen.

Runtime `print()` outputs flow into the platform's monitoring logs (Tail). For variables that need to be returned immediately to the browser, it is most reliable to include them in the `Response.json()` response payload.
