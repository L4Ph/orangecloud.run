# JavaScript Engines and Runtimes

The moment you attempt to run JavaScript outside of a browser, the execution environment inevitably splits into two components: the **engine**, which parses source code and executes it as bytecode or machine code, and the **runtime**, which connects that engine to the outside world via networks, timers, and other mechanisms. Without being mindful of this boundary, the architecture of Cloudflare Workers remains invisible.

## Engine (The Heart of Execution)

| Engine             | Primary Use Cases                            | Characteristics                                                           |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------- |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | Developed by Google. Has multiple tiers of JIT compilers                  |
| **SpiderMonkey**   | Firefox (Gecko)                              | Developed by Mozilla. JITs are Baseline and Warp (successor to IonMonkey) |
| **JavaScriptCore** | Safari (WebKit) / Bun                        | Developed by Apple. Runs code with an interpreter and three JIT tiers     |
| **QuickJS**        | Embedded/lightweight environments            | Hundreds of KBs. Tiny and boots instantly without JIT                     |
| **Hermes**         | React Native                                 | Assumes AOT compilation. Prioritizes startup time and memory              |

The engine's job is to run ECMAScript (the JavaScript language specification) and WebAssembly. It reads source code, assembles an abstract syntax tree, and executes it as bytecode or machine code. It provides built-in objects such as `Array` and `Promise`, and reclaims unneeded memory via garbage collection (GC). The ECMAScript specification includes neither a way to open files nor a way to listen on network sockets.

## Runtime (The Point of Connection to the World)

The runtime provides the engine with the means to communicate with the "outside world."

| Runtime                | Engine         | Interface to the Outside World                                                                                                    |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**            | V8             | OS system calls via libuv. `fs`, `net`, `process`                                                                                 |
| **Bun**                | JavaScriptCore | Native implementation written in Rust. `Bun.serve`, `Bun.file`. **Acquired by Anthropic in December 2025**                        |
| **Deno**               | V8             | Developed in Rust. Fine-grained permission model (`--allow-net`, etc.). **Joined Cloudflare in October 2026**                     |
| **Cloudflare Workers** | V8             | Isolated environment on the edge. The runtime is the open-source workerd. Web standard APIs (`fetch`, etc.) + Cloudflare bindings |

Since they both use the V8 engine, you would assume Node.js and Workers should work the same way—but if you bring your code in with that assumption, you'll be caught off guard within the first few lines. Workers has no local disk, and a Worker written as an ES module has no `require`. `process` and `node:fs` come from a compatibility layer (`nodejs_compat`), which is enabled by default for Workers with a compatibility date of 2026-08-04 or later. Even then, `node:fs` is a virtual file system held in memory.

Workers is built on the familiar Web standards (`fetch`, `Request`, `Response`, `crypto`) and platform-specific bindings.

The **V8 isolate** that powers Workers is neither an OS process nor an independent container. It packs hundreds or thousands of independent execution spaces into a single OS process. Each keeps its own independent memory space, and Cloudflare says an isolate starts about a hundred times faster than a Node process on a container or virtual machine.

When you run code in the editor, the validation results for the global space are output. The editor's Worker runs with compatibility date 2026-02-24 and without `nodejs_compat`, so `process` does not exist. The `navigator = object` line in the output is an object whose `navigator.userAgent` returns `Cloudflare-Workers`, which can be used to detect the runtime environment. Please verify what exists in this environment and what has been stripped away.

```js
typeof process; // undefined (no trace of Node.js; object if nodejs_compat is enabled)
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined (no browser DOM either)
typeof caches; // object (Cache API, with differences from the browser version)
```
