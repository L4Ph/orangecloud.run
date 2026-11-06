# Durable Objects (DO)

An object of which **exactly one instance exists per name, in the whole world**. It carries SQLite storage and serialized method calls. "Two at once is impossible" is the guarantee, so counters, inventory, chat rooms, rate limiters, and coordinators are built from these.

## Why you need it

A Worker may land on a different isolate for every request, so globals are not trustworthy. A DO is **one instance you call by name**, e.g. `Counter.get('global')`. Calls are processed one at a time inside that instance.

## What to remember

- Hand `env.COUNTER` a name and you get a stub for that instance
- Methods on the stub are RPC. Return values must be serializable
- Storage is SQLite (`ctx.storage.get/put`, and SQL if you want it)
- `ctx.storage.setAlarm()` gives you "wake me later" (reminders, batches)
- Nothing is billed while the object is idle (hibernation)

Here `env.COUNTER` is a real deployed Durable Object. **The value survives across runs.** Execute a few times and watch it climb.

```js
const n = await env.COUNTER.increment(); // same name, same instance
await env.COUNTER.read(); // read what was stored
```
