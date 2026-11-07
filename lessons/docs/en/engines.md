# JavaScript engines and runtimes

Code does not run by magic. An **engine** parses and executes it, and a **runtime** gives that engine "the outside world". Keeping those two apart makes Cloudflare Workers click.

## Engines (the part that executes JavaScript)

| Engine             | Where it runs                                | Notes                                        |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| **V8**             | Chrome / Node.js / Deno / Cloudflare Workers | Has a JIT. Fastest tier, bigger binary       |
| **SpiderMonkey**   | Firefox (Gecko)                              | The original implementation. Has a JIT (Ion) |
| **JavaScriptCore** | Safari (WebKit) / Bun                        | Apple's. JIT, small                          |
| **QuickJS**        | Embedded and tiny environments               | A few hundred KB. No JIT, so it starts fast  |
| **Hermes**         | React Native                                 | Optimises startup and memory. AOT compiled   |

An engine reads source → builds a syntax tree → executes it → reclaims memory (GC). It cannot open a file or wait on HTTP.

## Runtimes (the part that connects the engine to the world)

| Runtime                | Engine         | How it builds the world                                                                  |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| **Node.js**            | V8             | libuv + OS syscalls. `fs`, `net`, `process`                                              |
| **Bun**                | JavaScriptCore | Written in Rust. `Bun.serve`, `Bun.file`                                                 |
| **Deno**               | V8             | Written in Rust. Permission model (`--allow-net`, …). **Acquired by Cloudflare in 2025** |
| **Cloudflare Workers** | V8 isolate     | Isolates at the edge. Web standards such as `fetch` plus bindings                        |

There is no `process` and no `require`, yet `fetch` and `crypto` are there — that is Workers. An **isolate** is neither a process nor a container: it is a V8 execution unit packed many-to-a-process, starting in milliseconds.

Run the code below and you can see exactly what this Worker has and lacks.

```js
typeof process; // undefined
typeof Deno; // undefined
typeof Bun; // undefined
typeof document; // undefined
typeof caches; // object (the Workers Cache API)
```
