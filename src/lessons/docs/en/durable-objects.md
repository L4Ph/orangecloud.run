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

## In-memory State vs SQLite Storage

A DO has two places to keep state: **class fields (in-memory)** and **`ctx.storage` (SQLite)**.

|            | In-memory (class fields)                                          | SQLite (`ctx.storage`)                                  |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Speed      | Fastest (just a memory read)                                      | Fast (disk on the same machine, callable synchronously) |
| Durability | **Lost** on hibernation, eviction, a crash, or a code update      | **Kept** across restarts and deploys                    |
| Good for   | Caches, the list of connected WebSockets, batching before a write | All source-of-truth data                                |

When it is lost is well defined: after about 10 seconds with no traffic and the object is evicted, after an uncaught exception, and when new code is deployed (by default with a grace period of up to about 5 minutes). On the next call the `constructor()` runs again and fields return to their initial values.

So write the source of truth to SQLite first, and use memory to speed up reads. The usual pattern is to warm fields from SQLite in the constructor.

```ts
export class ChatRoom extends DurableObject {
  // A read cache that may disappear on eviction
  recent: Message[] | null = null;

  addMessage(text: string) {
    // Persist first, then drop the cache
    this.ctx.storage.sql.exec("INSERT INTO messages (text) VALUES (?)", text);
    this.recent = null;
  }
}
```

## WebSockets and the Hibernation API

Long-lived connections such as chat are what DOs do best. Everyone connects to the DO with the same name, so broadcasting needs no extra machinery.

With the standard `ws.accept()`, the DO stays in memory while any connection lives and is billed for that whole time. The **Hibernation API** hands the connection over with `this.ctx.acceptWebSocket(ws)` and delivers events to `webSocketMessage()` / `webSocketClose()` handlers. While no messages arrive, the DO can be evicted from memory without dropping the connections.

Eviction still wipes fields. Keep small per-connection data (such as a user name) in `ws.serializeAttachment()` and restore it with `ws.deserializeAttachment()` when woken. Put history in SQLite. Hibernation only works if you follow the split in the table above.

In the next chapter, [Write your own Durable Object](/lessons/durable-object-class), you can see the difference between the two kinds of state by editing code.

The `env.COUNTER` in the editor is an actual running Durable Object instance. By repeatedly executing the code, you can verify that the counter continues to increment reliably, even after the process is restarted.
