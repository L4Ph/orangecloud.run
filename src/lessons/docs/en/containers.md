# Containers (Container Execution Environment)

V8 isolates spin up in milliseconds and handle large numbers of requests effortlessly. However, when you want to transcode video with FFmpeg or run massive binaries written in C, you are blocked by the isolate wall. This is because neither OS kernel features nor arbitrary file execution permissions exist there.

Cloudflare Containers is the **last resort** for challenges that isolates simply cannot solve. You deploy your own Docker images directly to the edge, launching and stopping full Linux containers on demand behind Durable Objects.

## Trade-offs Between Isolates and Containers

| Comparison Item  | V8 isolate (Workers)                     | Cloudflare Containers                                                                  |
| ---------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Startup Time     | Milliseconds (immediate response)        | Order of seconds (waiting for container to start)                                      |
| Memory Limit     | 128MB (lightweight design)               | 256 MiB to 12 GiB (chosen by instance type)                                            |
| Executable Files | JS, TS, Wasm, Pyodide                    | Any Linux executables, shared libraries                                                |
| Billing Unit     | Executed CPU time and number of requests | Every 10 ms while running (memory and disk at the provisioned size, CPU at actual use) |

If you are only intermediating Web API requests, isolates start faster and are more resource-efficient. The golden rule of edge design is to **first think thoroughly about whether Workers alone can achieve the goal, and introduce containers only if that proves impossible**.

## Container Control via Durable Objects

To operate containers from code, use `this.ctx.container` of a Durable Object. The Durable Object starts the container with `start()`, runs commands with `exec()`, and connects to a port with `getTcpPort()`. `@cloudflare/sandbox` (1.0 and later) provides only helper classes such as `Files`.

```ts
import { DurableObject } from "cloudflare:workers";

// In defineContainer in cloudflare.config.ts, set schedulingPolicy to "durable-object"
// and declare a Dockerfile as images.default
export class Sandbox extends DurableObject {
  async nodeVersion() {
    const container = this.ctx.container;
    if (!container) throw new Error("No container is configured");

    if (!container.running) {
      container.start({
        image: container.images.default,
        entrypoint: ["sleep", "infinity"], // the container stops when its main process exits
        enableInternet: false,
      });
    }
    await container.setInactivityTimeout(10 * 60 * 1000);

    // Execute a command inside the container and receive standard output
    const process = await container.exec(["node", "--version"]);
    const { stdout } = await process.output();
    return new TextDecoder().decode(stdout).trim();
  }
}

export default {
  async fetch(request: Request, env: { SANDBOX: DurableObjectNamespace<Sandbox> }) {
    // Allocate a separate sandbox for each user ID or session
    const sandbox = env.SANDBOX.getByName("user-session-123");
    return new Response(`Container Node.js: ${await sandbox.nodeVersion()}`);
  },
};
```

A container stops once the time given to `setInactivityTimeout()` (6 hours at most) has passed since its Durable Object became inactive. While it runs, memory and disk are billed even when idle, and when it stops the contents of its disk are lost. Containers are available on the Workers Paid plan.
