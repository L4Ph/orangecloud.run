# Durable Objects (Distributed State Management)

The greatest strength of Workers was that, by being stateless, they could scale instantaneously across edges worldwide. However, real-world applications require "the world's only, absolutely unambiguous state," such as collaborative cursor synchronization, chat room participant management, and limited ticket allocation.

Relying on global variables leads to inconsistent values across separate isolates, while conventional databases cause headaches with concurrent write lock contention. **Durable Objects (DO)** were designed to solve this dilemma.

## Single Entity and Serialization Guarantee

Durable Objects ensure that the platform guarantees that **for every specified ID or name, there will always be exactly one instance in the entire world**.

1. **Unique Location**: Whether accessed from Tokyo or London, as long as the same `name` is specified, the request is routed to the same instance residing at a single location on Earth.
2. **Message Serialization**: Method calls and HTTP requests to that instance are queued and **executed sequentially, one at a time**. Since no multiple pieces of code run in parallel internally, there is no need to implement locking or transaction isolation levels from scratch.
3. **Non-volatile Persistent Storage**: Instances are equipped with dedicated built-in SQLite storage (`ctx.storage`), ensuring that data is stored not only in memory but also on disk, all within a single node.

## Characteristics Developers Should Know

- From the client side, methods can be called intuitively via RPC (Remote Procedure Call) through bindings.
- When access is lost, the instance is automatically hibernated from memory, preventing unnecessary charges. It is restored within a few milliseconds the moment the next request arrives.
- By calling `ctx.storage.setAlarm()`, the instance can be automatically started at a specific time in the future to perform timer processing or cleanup.

The `env.COUNTER` in the editor is an actual running Durable Object instance. By repeatedly executing the code, you can verify that the counter continues to increment reliably, even after the process is restarted.
