# Inside the runtime: what an isolate actually does

"V8 isolate" sounds like a speed claim. It is really a statement about what Workers leaves out, and that is what tells you when to stop using it.

## Processes versus isolates

Node.js has one V8 isolate inside one process, plus libuv's event loop, a thread pool, file descriptors, and sockets. Starting a process per request is too heavy, so everyone shares one — and with it, state and privileges.

A Worker has **just the isolate**. No process, no sockets, no files; the outside world is `fetch()` and bindings. That is why thousands of them fit on one machine and start in milliseconds. Not sharing state is simultaneously the safety model and the density trick.

## JIT and startup

V8 starts by running bytecode and only compiles hot functions to machine code. Isolate startup is "allocate a heap, compile the script" — no process spawn, no image unpacking. That gap is the decisive difference from containers.

|           | isolate                  | container                         |
| --------- | ------------------------ | --------------------------------- |
| Startup   | milliseconds             | hundreds of ms to tens of seconds |
| Isolation | heap and capabilities    | kernel namespaces                 |
| Can do    | web standards + bindings | anything                          |
| Billing   | requests + CPU ms        | wall time + memory                |

## Limits shape the design

- 128MB memory: no giant arrays. Stream instead
- 30s CPU (paid, 5 min max): waiting is free, computing is not
- No filesystem: scratch data goes to R2 or KV
- Subrequest caps: do not fan out hundreds of API calls per request

`nodejs_compat` fills in parts of Node's API, but not `fs`. When you truly need that, you need a container.

## Where to branch

1. Waiting on HTTP, querying a database, a little compute → **isolate**
2. Native binaries, heavy dependencies, >128MB, long-running processes → **container**
3. Minutes-to-days choreography → **Workflows**
4. Exactly one execution at a time → **Durable Objects**

Ask "can this be a Worker?" first and the architecture stays small.
