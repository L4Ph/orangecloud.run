# Durable Objects (Distributed State Management)

The strength of Workers was that, by being stateless, they could scale quickly across edges worldwide. However, real-world applications require "the world's only, absolutely unambiguous state," such as collaborative cursor synchronization, chat room participant management, and limited ticket allocation.

Relying on global variables leads to inconsistent values across separate isolates, while conventional databases cause headaches with concurrent write lock contention. **Durable Objects (DO)** were designed to solve this dilemma.

## Single Entity and Serialization Guarantee

The platform guarantees that **for every specified ID or name, exactly one instance runs at a time in the entire world**. This uniqueness is enforced when a new event starts and when storage is accessed.

1. **Unique Location**: Whether accessed from Tokyo or London, as long as the same `name` is specified, the request is routed to the same instance residing at a single location on Earth.
2. **Message Serialization**: An instance runs on a single thread, so the JavaScript for its method calls and HTTP requests never runs simultaneously. Code that only performs storage operations needs no hand-written locking. Other requests can run while one awaits non-storage I/O such as `fetch()`, so protect those sections with `blockConcurrencyWhile()` or an optimistic lock.
3. **Non-volatile Persistent Storage**: Instances are equipped with dedicated built-in SQLite storage (`ctx.storage`), so besides in-memory variables, you can read from and write to a dedicated SQLite database synchronously.

## Characteristics Developers Should Know

- From the client side, methods can be called intuitively via RPC (Remote Procedure Call) through bindings.
- When requests stop arriving, the instance is automatically evicted from memory (hibernated), and duration charges stop. When the next request arrives, `constructor()` runs again and the instance is recreated.
- By calling `ctx.storage.setAlarm()`, the instance can be automatically started at a specific time in the future to perform timer processing or cleanup.

## In-memory State vs SQLite Storage

A DO has two places to keep state: **class fields (in-memory)** and **`ctx.storage` (SQLite)**.

|            | In-memory (class fields)                                          | SQLite (`ctx.storage`)                                  |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Speed      | Fastest (just a memory read)                                      | Fast (disk on the same machine, callable synchronously) |
| Durability | **Lost** on hibernation, eviction, a crash, or a code update      | **Kept** across restarts and deploys                    |
| Good for   | Caches, the list of connected WebSockets, batching before a write | All source-of-truth data                                |

It is lost mainly in these cases: when the object enters hibernation after about 10 seconds idle (while timers, standard WebSockets, or unfinished I/O remain, it does not hibernate and instead leaves memory after 70 to 140 seconds), when new code is deployed (by default with a grace period of up to 5 minutes), when the Workers runtime is updated, and when the runtime moves the object to a different host. On the next call the `constructor()` runs again and fields return to their initial values.

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

Long-lived connections such as chat are a good fit for DOs. Everyone connects to the DO with the same name, so broadcasting needs no extra machinery.

With the standard `ws.accept()`, the DO stays in memory while any connection lives and is billed for that whole time. The **Hibernation API** hands the connection over with `this.ctx.acceptWebSocket(ws)` and delivers events to `webSocketMessage()` / `webSocketClose()` handlers. While no messages arrive, the DO can be evicted from memory without dropping the connections.

Eviction still wipes fields. Keep small per-connection data (such as a user name) in `ws.serializeAttachment()` and restore it with `ws.deserializeAttachment()` when woken. Put history in SQLite. Hibernation only works if you follow the split in the table above.

In the next chapter, [Write your own Durable Object](/lessons/durable-object-class), you can see the difference between the two kinds of state by editing code.

The `env.COUNTER` in the editor relays `increment()` and `read()` to a Durable Object that the site provides (named `lesson-counter`). Unlike a production binding, you cannot choose an instance with `idFromName()` or `getByName()`. The counter is shared by everyone and is deleted after 24 hours without a call. By repeatedly executing the code, you can verify that the counter keeps incrementing even after the process is restarted.
