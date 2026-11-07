# State Design at the Edge (Storage Selection Criteria)

Cloudflare Workers launch in independent memory spaces for each request. Since storing state in memory is not permitted, data must inevitably be delegated to an external storage layer.

The question is: "Which storage to choose?" A poor choice can lead to "ghost data" phenomena where previous writes cannot be read, explosions of query charges due to missing indexes, or bottlenecks caused by overloading a single instance. The selection criteria boil down to three points: **consistency model, data size, and billing triggers**.

## First-Round Screening by Consistency Model

| Storage             | Consistency Level                                            | Optimal Use Cases                                        | Dangerous Misuses                                              |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------- |
| **Workers KV**      | Eventual consistency (up to 60 seconds of propagation delay) | Configuration values, feature flags, URL redirect tables | Strict counters, balances, sessions immediately after purchase |
| **D1**              | Primary writes, replica reads                                | Structured data, relational searches, aggregations       | Storing binaries exceeding several megabytes                   |
| **Cloudflare R2**   | Strong consistency (per-object)                              | Images, videos, logs, backups                            | Fine-grained, frequent updates of several kilobytes            |
| **Durable Objects** | Fully serialized on a single node (strong consistency)       | Chat rooms, ticket inventory, distributed locking        | Indiscriminate aggregation of all requests                     |
| **Hyperdrive**      | Connection pool for existing relational DBs                  | High-speed communication with PostgreSQL / MySQL         | -                                                              |

Choose Durable Objects when you "want to update the only latest value in the world without contention," and D1 when relations or aggregations are required. Carelessly placing counters in KV will inevitably cause value reversion due to concurrent writes from different edges.

## Pitfalls of Size Constraints and Billing Structures

- **Workers KV**: 25MB per key. Read costs are minimal, but the write unit price ($5 per million writes) is relatively high; avoid designs with high update frequencies.
- **D1**: Charged based on **the number of rows scanned** rather than the number of queries issued. `WHERE` queries without `CREATE INDEX` will immediately drive up the bill by consuming all rows.
- **Cloudflare R2**: Only storage capacity and operation request counts are billed, and **outbound data transfer (Egress) is completely free**. Place static files with high delivery traffic in R2 without hesitation.
- **Durable Objects**: Pay-as-you-go based on request count and memory usage (GB seconds). Billing stops via automatic hiberation during periods with no access.

## Common Anti-patterns

1. **Using KV for session storage and verifying at the redirect destination immediately after login**: Due to the propagation delay of writes, authentication will fail if the key cannot be found during the subsequent read. The immediate state transition must be combined with stateless methods such as encrypted cookies.
2. **Storing image or PDF binaries directly in D1 columns**: This bloats the record row size, wasting read-row charges and I/O bandwidth during searches. The golden rule is to move the binary entities to R2 and record only the object keys in D1.
3. **Concentrating all traffic into a single Durable Object instance**: The serialization mechanism backfires, causing requests from around the world to queue on a single node and causing latency to degrade sharply. IDs must be finely distributed per tenant or user.

## Robust Combination Patterns

- **R2 (Actual Files) + D1 (Metadata Index)**: Store image and document bodies in R2 (free transfer), while performing index searches for tags, modification dates, and owner IDs in D1.
- **Durable Objects (Consistency Checkpoint) + Queues (Asynchronous Consumption)**: Serialize order allocations and inventory deductions in DO to ensure instantaneous consistency, then immediately route heavy payment processing and email delivery to Queues.
