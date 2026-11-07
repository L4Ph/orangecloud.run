# Containers (Edge Containers)

The constraints of V8 isolate are intentional. By seizing the filesystem, prohibiting resident processes, and limiting memory to 128MB, we achieved millisecond startup times and scaling to tens of thousands of concurrent processes. However, real-world workloads inevitably involve operations that push the boundaries of isolate.

Video encoding via FFmpeg, headless browser control via Playwright, executing existing binaries written in C/C++, or heavy data processing requiring several gigabytes of memory—these cannot run without the full functionality of the Linux kernel.

Cloudflare Containers is the **last resort** for such scenarios. By bringing standard Docker images to edge environments and integrating them with Durable Objects lifecycle control, we enable fully Linux containers to run on-demand.

## Architectural Comparison

| Evaluation Metric   | V8 isolate (Workers)                                     | Cloudflare Containers                                            |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Startup Latency     | 1–5 ms                                                   | Order of seconds (image extraction/startup)                      |
| Memory Allocation   | 128MB+                                                   | Configurable in multiple GiB units                               |
| Runtime Environment | Web standard APIs, Wasm, Pyodide                         | Full Linux (Debian, Alpine, Ubuntu, etc.)                        |
| Optimal Domain      | API routing, authentication, lightweight transformations | Heavy-duty batch processing, media conversion, sandbox execution |

For typical operations such as "receiving an HTTP request and hitting a database," isolate is overwhelmingly more agile and resource-efficient. The principle for avoiding pitfalls in edge design is to **explore every possible means using Workers alone, and only adopt containers when OS-native binaries or massive memory requirements prove indispensable**.

## Lifecycle Control via Sandbox SDK

The Cloudflare Sandbox SDK (`@cloudflare/sandbox`) is used to invoke containers. From the Worker side, the lifecycle of container instances is bundled via programming to control command execution and tunneling to internal ports.

```ts
import { getSandbox } from "@cloudflare/sandbox";

// Identify a sandbox environment isolated on a per-session basis
const sandbox = await getSandbox(env.SANDBOX, "session-456");

// Execute a command in a shell within an independent Linux environment
const execution = await sandbox.run('python3 -c "print(1 + 1)"');
console.log("stdout:", execution.stdout.trim());
```

Containers automatically stop when no communication occurs, minimizing CPU resource consumption. The architecture is designed so that no unnecessary charges are incurred for prolonged idle states.
