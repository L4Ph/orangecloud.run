# JavaScript Engines and Runtimes

The moment you attempt to run JavaScript outside of a browser, the execution environment inevitably splits into two components: the **engine**, which interprets the syntax tree and translates it into machine code, and the **runtime**, which connects that engine to the outside world via networks, timers, and other mechanisms. Without being mindful of this boundary, the architecture of Cloudflare Workers remains invisible.

## Engine (The Heart of Execution)

| Engine           | Primary Use Cases                                   | Characteristics                                 |
| ------------------ | -------------------------------------------- | ------------------------------------ |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | Equipped with JIT compilation. Fast, but large binaries |
| **SpiderMonkey**   | Firefox (Gecko)                             | An implementation from the earliest days. Equipped with JIT (Ion) |
| **JavaScriptCore** | Safari (WebKit) / Bun                        | Developed by Apple. Equipped with JIT for superior startup and memory efficiency |
| **QuickJS**        | Embedded/lightweight environments                           | Hundreds of KBs. Tiny and boots instantly without JIT |
| **Hermes**         | React Native                                 | Assumes AOT compilation. Prioritizes startup time and memory |

The engine's responsibilities are extremely limited. It reads source code, assembles an abstract syntax tree, executes it as bytecode or machine code, and reclaims unnecessary memory via garbage collection (GC). That is all. The engine possesses no functionality for opening files or listening for network sockets.

## Runtime (The Point of Connection to the World)

The runtime provides the engine with the means to communicate with the "outside world."

| Runtime             | Engine       | Interface to the Outside World                                               |
| ---------------------- | -------------- | -------------------------------------------------------------------------- |
| **Node.js**            | V8             | OS system calls via libuv. `fs`, `net`, `process`                     |
| **Bun**                | JavaScriptCore | Proprietary native implementation (Zig/Rust). `Bun.serve`, `Bun.file`                  |
| **Deno**               | V8             | Developed in Rust. Fine-grained permission model (`--allow-net`, etc.). **Acquired by Cloudflare in 2025** |
| **Cloudflare Workers** | V8 isolate     | Isolated environment on the edge. Web standard APIs (`fetch`, etc.) + Cloudflare bindings  |

Since they both use the V8 engine, you would assume Node.js and Workers should work the same way—but if you bring your code in with that assumption, you'll be caught off guard within the first few lines. Workers lacks `process`, `require`, and even a local file system.

In their place are the familiar Web standards (`fetch`, `Request`, `Response`, `crypto`) and platform-specific bindings.

The **V8 isolate** that powers Workers is neither an OS process nor an independent container. It packs thousands of independent execution spaces tightly within a single OS process. While maintaining its own independent memory space, it takes only a few milliseconds to boot.

When you run code in an editor, the validation results for the global space are output. Please verify what exists in this environment and what has been stripped away.

```js
typeof process; // undefined (no trace of Node.js)
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined (no browser DOM either)
typeof caches; // object (Web standard Cache API)
```
