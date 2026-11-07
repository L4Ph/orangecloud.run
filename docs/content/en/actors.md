# Durable Objects and the Actor model

A Durable Object (DO) is often described as "a tiny server with state". It is really an implementation of the **Actor model**, and that explains why DOs are written as classes and why their method calls are serialized.

## The promises of the Actor model

Actor systems (Erlang processes, Akka actors) rest on four ideas.

1. **Identity**: every actor is addressable by name; the same name is always the same entity
2. **Private state**: state lives inside the actor; nobody reaches in
3. **Messages**: the only interaction is sending messages, queued in a mailbox
4. **One at a time**: an actor processes one message at a time, so no internal races

No shared memory, no locks, and no need to know where the actor lives (location transparency).

## Mapping to Durable Objects

| Actor model               | Durable Objects                                               |
| ------------------------- | ------------------------------------------------------------- |
| Actor name                | the name inside `env.ROOM.get(env.ROOM.idFromName('room-1'))` |
| Private state             | `ctx.storage` (SQLite) plus fields on `this`                  |
| Messages                  | `fetch()` (HTTP) and RPC methods                              |
| Mailbox and serialization | provided by the platform; methods run one at a time           |
| Death and rebirth         | isolate eviction and hibernation; state stays in storage      |
| Location                  | the colo that first touched it                                |

## Why a class

**A class is the unit of behavior and the unit of deployment.** Instances are named.

- You create thousands of instances with the same behavior, so the type (class) and the instance (name) must be separate
- The class name is what bindings and migrations (`new_sqlite_classes`) refer to; moving code to another class makes another resource
- Methods are message handlers. RPC is typed; `fetch` is for HTTP
- `this.ctx` carries storage, alarms, and the id: capabilities belong to the instance
- The constructor runs **on every activation**. Fields are volatile; durability lives in storage — the language makes that distinction hard to ignore

With a function plus KV you would rebuild serialization, mutual exclusion, restoration, and placement yourself.

## Shape

```ts
export class Room extends DurableObject {
  async join(user: string) {
    const members = (await this.ctx.storage.get<string[]>('members')) ?? [];
    if (!members.includes(user)) members.push(user);
    await this.ctx.storage.put('members', members);
    return members;
  }

  async alarm() {
    // Woken once, 30 minutes later
    await this.ctx.storage.deleteAll();
  }
}
```

`join` is an RPC method. Two concurrent callers are processed one after another, so `members` cannot be corrupted.

## Limits

- **No parallelism inside**: one DO has roughly one core of throughput. Split hot keys (per user, per room)
- Other messages interleave **only at `await`**. Be careful when reading state across an await
- Not for scanning lots of rows. Aggregate in D1, store bytes in R2
- Placement is decided by the first access. Funnelling the world into one DO is slow
- Nothing is billed while idle (hibernation). Use the Hibernation API for WebSockets

## Problems actors solve

Chat rooms, inventory, game rooms, rate limiters, workflow coordinators, an AI agent's memory. If the requirement is **"one holder of state per name, touched by one caller at a time"**, use a DO. Read-heavy lists and aggregates belong in D1; bytes belong in R2.
