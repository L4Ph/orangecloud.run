# KV (Key-Value)

A key-value store with fast reads, replicated to the edge all over the world. **Writes are eventually consistent** (up to 60 seconds), so it is a poor fit for counters or inventory where exactness matters.

## What it is good for

- Config, feature flags, redirect tables
- Session caches, cached OG images
- Read-heavy data with few writes

## What to remember

- `get` / `put` / `delete` / `list` (with a prefix)
- 25MB per value; storing JSON keeps reads easy
- Listing is `list()` with a prefix. Full scans are not its job
- Writes cost more than reads ($5 per million writes)

In this sandbox `env.KV` proxies the real namespace over RPC. The `get/put/delete/list` shape matches production, so learn it as-is.

```js
await env.KV.put('user:1', 'Alice');
await env.KV.get('user:1');      // 'Alice'
await env.KV.list('user:');      // ['user:1', 'user:2', ...]
```
