# Choosing where state lives

A Worker gets a clean room per request, so state always lives somewhere else. The question is where, and three properties decide it: **consistency, size, and billing**.

## Start from consistency

| Store              | Consistency                         | Good for                                |
| ------------------ | ----------------------------------- | --------------------------------------- |
| KV                 | eventual (up to 60s)                | config, caches, flags                   |
| D1                 | single primary, reads from replicas | tabular data, search, aggregates        |
| R2                 | strong per object                   | files, images, backups                  |
| Durable Objects    | serialized inside one instance      | counters, inventory, coordination, chat |
| Queues / Workflows | at-least-once                       | deferred and long-running work          |

If "exactly one" must hold, use Durable Objects or a D1 transaction. A counter in KV loses writes under concurrency.

## Narrow by size and cost

- KV values up to 25MB; writes cost more than reads ($5 per million writes)
- D1 bills **rows read** and **rows written**; a `WHERE` without an index pays for every row
- R2 bills storage and operations, and **egress is free** — serve files from here
- DOs are not billed while idle (hibernation); you pay requests and GB-seconds

## Anti-patterns

- Session in KV, read immediately after writing → still null. Return it in the response
- Images in D1 → fat rows and read bills. Put bytes in R2 and keep the key
- Everything in one DO → calls serialize and queue up. Only hot spots belong there
- Cache in a global variable → gone when the isolate changes. Only cache what you can lose

## Useful shapes

1. **R2 + D1**: bytes in R2, metadata in D1. List from D1, fetch from R2
2. **KV + signed URLs**: config in KV, delivery straight from R2 without touching the Worker
3. **DO + Queues**: keep ordering in a DO, push the heavy work to a queue
4. **Workflows + D1**: write progress to D1 and resume from the failed step

## How this site does it

`env.DB` and `env.COUNTER` hand real bindings to the sandbox. KV / R2 / AI namespaces cannot be cloned into an isolate, so they are relayed through a Durable Object's RPC. Either way the principle is the same: state lives outside.
