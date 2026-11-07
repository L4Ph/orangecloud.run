# Containers (Container Execution Environment)

V8 isolates spin up in milliseconds and handle thousands of requests effortlessly. However, when you want to transcode video with FFmpeg, drive a headless browser with Playwright, or run massive binaries written in C, you are blocked by the isolate wall. This is because neither OS kernel features nor arbitrary file execution permissions exist there.

Cloudflare Containers is the **last resort** for challenges that isolates simply cannot solve. You deploy your own Docker images directly to the edge, launching and stopping full Linux containers on demand behind Durable Objects.

## Trade-offs Between Isolates and Containers

| Comparison Item  | V8 isolate (Dynamic Workers)          | Cloudflare Containers                             |
| ---------------- | ------------------------------------- | ------------------------------------------------- |
| Startup Time     | Few milliseconds (immediate response) | Order of seconds (waiting for container to start) |
| Memory Limit     | 128MB+ (lightweight design)           | Gigabytes available                               |
| Executable Files | JS, TS, Wasm, Pyodide                 | Any Linux executables, shared libraries           |
| Billing Unit     | Executed CPU time                     | Container startup time (vCPU minutes/GiB hours)   |

If you are only intermediating Web API requests, isolates are overwhelmingly faster and cheaper. The golden rule of edge design is to **first think thoroughly about whether Workers alone can achieve the goal, and introduce containers only if that proves impossible**.

## Container Control via Sandbox SDK

To operate containers from code, use Cloudflare's Sandbox SDK (`@cloudflare/sandbox`). You can call container instances on-demand from within a Worker to execute shell commands or expose ports.

```ts
import { getSandbox } from "@cloudflare/sandbox";

// Allocate a separate sandbox for each user ID or session
const sandbox = await getSandbox(env.SANDBOX, "user-session-123");

// Execute a command inside the container and receive standard output
const result = await sandbox.run("node --version");
console.log("Container Node.js:", result.stdout);
```

Containers automatically enter a sleep state when requests stop, and only the time they are actively in use is billed.
