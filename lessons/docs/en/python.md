# Python

Workers is not a JavaScript-only place. **Python Workers** run Python in the same isolate.

## Shape

```python
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response.json({"hello": "python"})
```

- `fetch` on the `Default` class is the entry point, the same role as `export default { fetch }`
- `Response` is the standard response object; `Response.json()` returns JSON
- Bindings and variables are on `self.env` (`self.env.KV`, …)

## Running it

The Worker needs a compatibility flag.

```jsonc
{ "compatibility_flags": ["python_workers"] }
```

Locally `npx wrangler dev`, deployed with `npx wrangler deploy`. This site's editor passes the same flag when it runs your code.

## When it fits

- Good: shaping data, text processing, porting existing Python, post-processing AI output
- Not good: heavy scientific work, native extensions, gigabytes of data. Packages are constrained like Pyodide; `numpy` may run but slowly. Use Containers when you truly need that

## Logs

`print()` goes to Workers logs (tail), not to this site's response. Put values you want to see inside `Response.json()`.
