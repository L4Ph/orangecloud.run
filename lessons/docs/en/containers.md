# Containers

The **last resort** when Workers (isolates) are not enough. You can run a Docker image as-is; Cloudflare starts and stops containers behind a Durable Object.

## When an isolate is not enough

- Native binaries and heavy dependencies (ffmpeg, scientific Python, Playwright)
- Long-running processes (WebSocket servers, game servers)
- Work that needs more than 128MB of memory
- Reusing an existing Docker image unchanged

If you are only "waiting on HTTP" or "querying a database", the isolate is faster and cheaper. **First ask whether Workers can do it.**

## Shape of the code

```ts
const sandbox = await getSandbox('user-123');
const result = await sandbox.run(['node', '--version']);
```

Void integrates Cloudflare Sandbox as `void/sandbox`: `getSandbox(id)` gives you a container with `run`, file operations, and port forwarding.

## Pricing and startup

|         | Paid plan                                     |
| ------- | --------------------------------------------- |
| Memory  | 25 GiB-hours/month included                   |
| CPU     | 375 vCPU-minutes/month included               |
| Startup | Seconds (isolates are milliseconds)           |
| Sleep   | Scales down when idle; billed only while used |

**Seconds to start, plus image build and placement costs even when idle**, so isolates (Dynamic Workers) are the better fit for an educational sandbox. This site is built that way.

This chapter is reference only (building and running containers needs Docker and a paid Workers plan).
