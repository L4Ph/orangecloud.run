import { DurableObject } from "cloudflare:workers";
import { Files } from "@cloudflare/sandbox";

const INACTIVITY_MS = 10 * 60 * 1000;
const RUN_TIMEOUT_MS = 20_000;
const decode = (bytes: ArrayBuffer) => new TextDecoder().decode(bytes);

// Runs one script at a time in a container that starts on demand. The image only sleeps:
// each run writes the script into /workspace and executes it, with no network.
export class SandboxV1 extends DurableObject {
  async run(argv: string[], script: { name: string; content: string }) {
    const container = this.ctx.container;
    if (!container) throw new Error("The sandbox container is not configured.");

    if (!container.running) {
      container.start({ image: container.images.default, instance: "lite", enableInternet: false });
    }
    await container.setInactivityTimeout(INACTIVITY_MS);
    await (await container.exec(["sh", "-c", "mkdir -p /workspace"])).output();

    const files = new Files({ exec: (command, options) => container.exec(command, options) });
    const path = `/workspace/${script.name}`;
    await files.writeFile(path, script.content);
    // A signal that fires after the process exited raises an uncaught error in this Durable
    // Object, so AbortSignal.timeout() must not be passed to exec(). Abort through a controller
    // and stop the timer as soon as the process is done.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
    try {
      const process = await container.exec(argv, { cwd: "/workspace", signal: controller.signal });
      void process.exitCode.then(() => clearTimeout(timer));
      const output = await process.output();
      return {
        exitCode: output.exitCode,
        stdout: decode(output.stdout),
        stderr: decode(output.stderr),
      };
    } finally {
      clearTimeout(timer);
      await files.remove(path).catch(() => {});
    }
  }
}
