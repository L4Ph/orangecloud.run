# State Design at the Edge (Storage Selection Criteria)

A single Cloudflare Workers instance can handle multiple requests at the same time. There is no guarantee which requests reach the same instance, and an instance can be evicted at any moment. You therefore cannot rely on in-memory variables for state, and data has to be delegated to an external storage layer.

The question is: "Which storage to choose?" A poor choice can lead to "ghost data" phenomena where previous writes cannot be read, explosions of query charges due to missing indexes, or bottlenecks caused by overloading a single instance. The selection criteria boil down to three points: **consistency model, data size, and billing triggers**.

## First-Round Screening by Consistency Model

| Storage             | Consistency Level                                                                                                    | Optimal Use Cases                                        | Dangerous Misuses                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| **Workers KV**      | Eventual consistency (changes can take 60 seconds or more to show up in other locations)                             | Configuration values, feature flags, URL redirect tables | Strict counters, balances, sessions immediately after purchase |
| **D1**              | Single primary by default (replica reads must be enabled and use the Sessions API)                                   | Structured data, relational searches, aggregations       | Storing large binaries (2 MB per row is the limit)             |
| **Cloudflare R2**   | Strong consistency (per-object)                                                                                      | Images, videos, logs, backups                            | Fine-grained, frequent updates of several kilobytes            |
| **Durable Objects** | Single instance, strongly consistent storage (other requests can interleave while awaiting non-storage I/O)          | Chat rooms, ticket inventory, distributed locking        | Indiscriminate aggregation of all requests                     |
| **Hyperdrive**      | Connection pooling plus read-query caching (on by default; results can be stale for the default 60-second `max_age`) | High-speed communication with PostgreSQL / MySQL         | Reads right after a write (when caching is on)                 |

Choose Durable Objects when you "want to update the only latest value in the world without contention," and D1 when relations or aggregations are required. Carelessly placing counters in KV means concurrent writes from different locations overwrite each other (last write wins) and increments are lost.

## Pitfalls of Size Constraints and Billing Structures

- **Workers KV**: 25MB per key. Reads cost $0.50 per million, but writes cost $5 per million, so avoid designs with high update frequencies.
- **D1**: Charged based on **the rows read (scanned) and the rows written**, not the number of queries issued. A `WHERE` query without a `CREATE INDEX` scans every row and drives up the rows-read count. An index, in turn, adds one more row written for each write.
- **Cloudflare R2**: Billed for storage capacity and operation counts (Class A / Class B), and **outbound data transfer (Egress) directly from R2 is free**. Reads are still billed as Class B operations, though, and the Infrequent Access class also charges a data retrieval fee. For static files with heavy delivery traffic, estimate the operation counts before placing them in R2.
- **Durable Objects**: Pay-as-you-go based on request count and execution time (elapsed wall-clock time, converted to GB-seconds at a fixed 128 MB). SQLite storage is also billed for rows read, rows written, and stored data. While an object is idle and eligible for hibernation, no duration charges accrue.

## Common Anti-patterns

1. **Using KV for session storage and verifying at the redirect destination immediately after login**: If the redirect is served from a different location, a stale value (or no key at all) can be returned until the cache expires, and authentication fails. Combine the immediate state transition with stateless methods such as encrypted cookies.
2. **Storing image or PDF binaries directly in D1 columns**: A row (a single BLOB) is limited to 2 MB, which images and PDFs often exceed, and the whole database is limited to 10 GB (500 MB on the Free plan). Note that rows-read charges do not depend on row size (a 1 KB row and a 100 KB row both count as one row). Keep the binary data in R2 and record only the object keys in D1.
3. **Concentrating all traffic into a single Durable Object instance**: The serialization mechanism backfires, causing requests from around the world to queue on a single node and causing latency to degrade sharply. IDs must be finely distributed per tenant or user.

## Robust Combination Patterns

- **R2 (Actual Files) + D1 (Metadata Index)**: Store image and document bodies in R2 (free transfer), while performing index searches for tags, modification dates, and owner IDs in D1.
- **Durable Objects (Consistency Checkpoint) + Queues (Asynchronous Consumption)**: Serialize order allocations and inventory deductions in a DO to ensure consistency, and hand time-consuming payment processing and email delivery off to Queues.
