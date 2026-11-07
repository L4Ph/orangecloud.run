# Workers KV (Key-Value Store)

Instantly replicating data to hundreds of edges worldwide and reading it back with minimal latency—on the surface, it sounds like an all-purpose data store. However, this astonishing read speed is built upon a massive compromise: **Eventual Consistency**.

Writes to KV are first sent to central storage, from where they propagate asynchronously to each data center. This propagation process can take up to 60 seconds to complete. There is no guarantee that the latest value written at the Tokyo edge will be visible when read from the London edge at that same moment.

## Suitable and Unsuitable Use Cases

- **Suitable for**: Configuration values, feature flags, URL redirect tables, session information caching, and OGP metadata caching (data where writes are extremely rare and reads are overwhelmingly frequent).
- **Unsuitable for**: Inventory allocation counters, balance management, and real-time participant counts (applications where a failure to reflect the most recent update would cause a critical issue).

## Basic Operations and Technical Limitations

- `get(key)` / `put(key, value)` / `delete(key)` / `list({ prefix })`
- The maximum size of a value stored in a single key is 25MB. This is sufficient for caching JSON strings or binary data.
- List retrieval supports only prefix matching (`prefix`) searches. It is not well-suited for full-query scans or complex filtering.
- The pricing structure is more expensive for writes than for reads ($5 per million writes). Designs with high write frequency will drive up costs.

The `env.KV` in the editor is a RPC proxy for the actual KV infrastructure, provided for a learning sandbox. The behavior of the provided methods' arguments and return values is identical to that of the production environment.

```js
await env.KV.put('user:1', 'Alice');
const user = await env.KV.get('user:1'); // 'Alice'
const list = await env.KV.list({ prefix: 'user:' }); // { keys: [...] }
```
