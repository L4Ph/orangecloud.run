# Running code in Containers

An isolate is fast and cheap, and it has no OS commands, no native libraries, no filesystem. **Containers** are where you give those up. You run a Docker image as it is.

The editor in this chapter writes your Python into a file inside a container and runs `python3`. Whatever it prints comes back.

## What changes

|           | isolate                  | container                          |
| --------- | ------------------------ | ---------------------------------- |
| Startup   | milliseconds             | seconds                            |
| Available | web standards + bindings | OS commands, any binary, pip / apt |
| Files     | none                     | yes, but ephemeral                 |
| Billing   | requests + CPU           | wall time + memory                 |

Python, ffmpeg, Playwright, and scientific stacks with native extensions do not run in an isolate. If all you do is wait on HTTP or query a database, the isolate is faster and cheaper.

## How this site does it

- The image is `Dockerfile.sandbox` (Node base plus `python3`)
- `getSandbox('lesson-container')` gives one container that is reused
- Each run writes `/workspace/run-<id>.py`, executes `python3`, then deletes it
- Outbound networking is disabled

```ts
const sandbox = await getSandbox('lesson-container');
await sandbox.files.writeFile('/workspace/main.py', code);
const result = await sandbox.run(['python3', 'main.py'], { cwd: '/workspace' });
```

## Caveats

- Containers take **seconds** to start and stop when idle, so the first run is slow
- You are billed while they run; this is not the place for high-frequency work
- State does not survive. Put what matters in D1 / R2 / KV

Where to draw the line between isolate and container is covered in [Inside the runtime](/docs/runtimes).
