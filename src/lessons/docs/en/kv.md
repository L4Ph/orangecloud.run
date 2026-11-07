# Workers KV (Key-Value Store)

Serving frequently read keys with low latency from caches in hundreds of edge cities worldwide—on the surface, it sounds like an all-purpose data store. However, this read speed is built upon a trade-off: **Eventual Consistency**.

A write to KV first goes to the central data store. It is not sent automatically to every location's cache; a value is cached as it is read (replication that combines push and pull). Other locations therefore keep showing the old value until the cache expires (`cacheTtl`, 60 seconds by default), and a change can take 60 seconds or more to show up. There is no guarantee that the latest value written at the Tokyo edge will be visible when read from the London edge at that same moment.

## Suitable and Unsuitable Use Cases

- **Suitable for**: Configuration values, feature flags, URL redirect tables, session information caching, and OGP metadata caching (data where writes are extremely rare and reads are overwhelmingly frequent).
- **Unsuitable for**: Inventory allocation counters, balance management, and real-time participant counts (applications where a failure to reflect the most recent update would cause a critical issue).

## Basic Operations and Technical Limitations

- `get(key)` / `put(key, value)` / `delete(key)` / `list({ prefix })`
- The maximum size of a value stored in a single key is 25MB. This is sufficient for caching JSON strings or binary data.
- List retrieval supports only prefix matching (`prefix`) searches. It is not well-suited for full scans or complex filtering.
- The pricing structure is more expensive for writes than for reads ($5 per million writes). Designs with high write frequency will drive up costs.

The `env.KV` in the editor relays to the real KV over RPC, and its arguments and return values differ from the production binding. `put()` stores an object as a JSON string (the production `put()` accepts only a string, an ArrayBuffer, or a stream). `get()` always returns a string and takes no `type`. `put()` options and `getWithMetadata()` are not available either. `list()` takes a prefix (a string or `{ prefix }`) and returns an array of key names (in production it returns `{ keys, list_complete, cursor }`). The keys are shared by everyone.

```js
await env.KV.put("user:1", "Alice");
const user = await env.KV.get("user:1"); // 'Alice'
const list = await env.KV.list({ prefix: "user:" }); // ["user:1", ...] in the editor, { keys: [...], list_complete, cursor } in production
```
