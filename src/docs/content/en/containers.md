# Containers (Edge Containers)

The constraints of V8 isolate are intentional. By withholding a persistent filesystem, prohibiting resident processes, and limiting memory to 128MB, we gained millisecond startup times and high concurrency. However, real-world workloads inevitably involve operations that push the boundaries of isolate.

Video encoding via FFmpeg, executing existing binaries written in C/C++, or heavy data processing requiring several gigabytes of memory. These all assume OS processes and a filesystem. If all you need is to control a headless browser, Browser Run lets you drive one with Playwright from Workers.

Cloudflare Containers is the **last resort** for such scenarios. By bringing standard Docker images to edge environments and integrating them with Durable Objects lifecycle control, we enable fully Linux containers to run on-demand.

## Architectural Comparison

| Evaluation Metric   | V8 isolate (Workers)                                     | Cloudflare Containers                                            |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Startup Latency     | Milliseconds                                             | Around 1–3 seconds (depends on image size and startup work)      |
| Memory Allocation   | 128MB (hard limit)                                       | 256 MiB to 12 GiB (chosen by instance type)                      |
| Runtime Environment | Web standard APIs, Wasm, Pyodide                         | Full Linux (Debian, Alpine, Ubuntu, etc.)                        |
| Optimal Domain      | API routing, authentication, lightweight transformations | Heavy-duty batch processing, media conversion, sandbox execution |

For typical operations such as "receiving an HTTP request and hitting a database," isolates start faster and are more resource-efficient. The principle for avoiding pitfalls in edge design is to **explore every possible means using Workers alone, and only adopt containers when OS-native binaries or massive memory requirements prove indispensable**.

## Lifecycle Control via Durable Objects

Containers are controlled through `this.ctx.container` of a Durable Object. A Worker calls the Durable Object by name; the Durable Object starts the container with `start()`, runs commands with `exec()`, and decides how long the container stays up with `setInactivityTimeout()`. `@cloudflare/sandbox` (1.0 and later) provides only helper classes such as `Files`; it does not start, stop, or monitor the container. The `durable_object` scheduling policy used here is in public beta, and the older `default` policy is deprecated.

```ts
import { DurableObject } from "cloudflare:workers";

// In defineContainer in cloudflare.config.ts, set schedulingPolicy to "durable-object"
// and declare a Dockerfile as images.default
export class Sandbox extends DurableObject {
  async run(argv: string[]) {
    const container = this.ctx.container;
    if (!container) throw new Error("No container is configured");

    if (!container.running) {
      // start() returns before the container is ready. exec() waits for a container that is still starting
      container.start({
        image: container.images.default,
        instance: "lite", // 1/16 vCPU, 256 MiB of memory
        entrypoint: ["sleep", "infinity"], // the container stops when its main process exits
        enableInternet: false, // do not allow outbound traffic
      });
    }
    // Stop 10 minutes after the Durable Object becomes inactive (6 hours at most)
    await container.setInactivityTimeout(10 * 60 * 1000);

    // exec() runs the argument array as-is, without a shell
    const process = await container.exec(argv);
    const { exitCode, stdout } = await process.output();
    return { exitCode, stdout: new TextDecoder().decode(stdout) };
  }
}

export default {
  async fetch(request: Request, env: { SANDBOX: DurableObjectNamespace<Sandbox> }) {
    // Use a separate Durable Object (and container) for each session
    const sandbox = env.SANDBOX.getByName("session-456");
    const { stdout } = await sandbox.run(["node", "--version"]);
    return new Response(stdout);
  },
};
```

A container stops once the time given to `setInactivityTimeout()` (6 hours at most) has passed since its Durable Object became inactive. Without a timeout, it stops right after the Durable Object becomes inactive. Billing is in 10 ms increments: while the container runs, memory and disk are billed at their provisioned size even when idle, and CPU is billed only for actual use. Billing stops when the container stops, but the contents of its disk are lost. Containers are available on the Workers Paid plan.
