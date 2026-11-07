# Python Workers

Attempting to run Python scripts in edge environments has long been a formidable challenge. Attempting to launch a Docker container forces a several-second cold start, and memory consumption in virtual machines becomes a headache. Meanwhile, glue code for data processing, text analysis, and machine learning remains most naturally written in Python.

Cloudflare's **Python Workers** takes an approach that bridges this gap. Rather than spinning up a container, it directly launches a Python execution platform (Pyodide) compiled to WebAssembly inside a V8 isolate. With the exact same agility as JavaScript Workers, Python code can start running while maintaining a cold start of just a few milliseconds.

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

## Application Boundary

- **Areas where it excels**: JSON data transformation, advanced text formatting using regular expressions, porting existing Python business logic, and post-processing of outputs received from LLMs.
- **Areas to avoid**: Analysis of large-scale datasets spanning gigabytes, and heavy-duty scientific computing requiring native extension modules in C. Packages must be limited to those capable of running on WebAssembly; heavy-duty native libraries are disadvantageous in terms of initialization and execution speed. If a complete OS-level environment is required, Containers should be chosen.

Runtime `print()` outputs flow into the platform's monitoring logs (Tail). For variables that need to be returned immediately to the browser, it is most reliable to include them in the `Response.json()` response payload.
