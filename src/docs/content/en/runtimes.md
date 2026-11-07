# Comparing Runtime Structures (Node.js vs. V8 Isolate)

The history of server-side JavaScript has long been equated with the architecture of Node.js. However, in the face of the requirements of edge computing—"ultra-short startup times," "extremely high capacity density," and "secure multi-tenant isolation"—the underlying structure of Node.js becomes a significant hindrance.

By understanding what **V8 isolate**, which powers Cloudflare Workers, stripped away and what it retained, it becomes possible to make accurate design decisions for the edge.

## Fundamental Differences in Process Models and Isolation Architectures

Node.js assigns a single V8 instance to a single OS process. Outside of that lies a web of libuv event loops, multithreading pools, file descriptor tables, and raw socket management mechanisms. This structure assumes that a single process remains resident indefinitely, making it utterly unsuitable for operations where a process is created and destroyed for every request.

```
[Node.js Process Structure]
OS Process ── libuv (C++ / Thread Pool / File I/O / Network Sockets)
             └── Single V8 Instance (Shares heap and state across all requests)

[Workers' Isolate Structure]
Single Host Process ── Isolation Boundary (Memory Protection / Privileged Sandbox)
                      ├── Isolate A (User A's heap / Independent memory space)
                      ├── Isolate B (User B's heap / Independent memory space)
                      └── Isolate C (User C's heap / Independent memory space)
```

Cloudflare Workers completely hides the OS process layer and treats **V8 isolate alone** as the basic unit of execution. Within a single host process, thousands of isolates—with strictly decoupled memory spaces—are packed tightly together.

By stripping away privileged system calls, such as file system access and direct socket control, from the outset, it fundamentally eliminates the risk of other code peering into adjacent memory regions on the same host.

## Physical Limits of Cold Starts

Starting a container (such as Docker) requires a series of essential steps: unpacking the container image, initializing the Linux namespace, configuring virtual network interfaces, and launching the guest process. No matter how much you optimize, this process takes several hundred milliseconds to several seconds.

In contrast, launching an isolate is completed simply by "initializing the V8 heap area" and "loading precompiled bytecode." Since there are no network or virtual machine boot sequences, as a physical constraint, request processing can begin within 1 to 5 milliseconds.

## Architectural Selection Boundary

| Process Nature                                                    | Optimal Choice            | Rationale                                                          |
| ----------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| Web APIs, lightweight business logic, data relay                  | **V8 isolate (Workers)**  | Startup is in milliseconds; zero idle cost                         |
| Long-running batches, FFmpeg, Playwright                          | **Cloudflare Containers** | A full Linux kernel and binary execution environment are essential |
| Waiting for external connections (DB queries, external REST APIs) | **V8 isolate (Workers)**  | Free network wait time due to CPU time billing                     |
| Serialization to a single resource and exclusive control          | **Durable Objects**       | Consolidate requests into a single instance globally               |

When bringing in libraries for Node.js, the `nodejs_compat` compatibility flag can be used, but this only provides a subset of abstraction layers close to Web standards, such as `Buffer`, `crypto`, and `events`. Designs that assume local disk operations via `fs` are fundamentally incompatible with the philosophy of isolate.
