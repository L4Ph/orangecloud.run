# KV（Key-Value）

读取很快、复制到全球边缘的键值存储。**写入是最终一致**（最长 60 秒），所以不适合计数器或库存这类要求精确的场景。

## 适合的用途

- 配置值、功能开关、重定向表
- 会话缓存、OGP 图片缓存
- 写少读多的数据

## 要记住的

- `get` / `put` / `delete` / `list`（带前缀）
- 单个值最大 25MB，存 JSON 读起来更方便
- 列举用 `list()` 做前缀查询，全量扫描不是它的强项
- 写入比读取贵（每 100 万次写入 $5）

本环境中的 `env.KV` 是通过 RPC 中转的真实 KV。`get/put/delete/list` 的形态与线上一致，照着记即可。

```js
await env.KV.put('user:1', 'Alice');
await env.KV.get('user:1');      // 'Alice'
await env.KV.list('user:');      // ['user:1', 'user:2', ...]
```
