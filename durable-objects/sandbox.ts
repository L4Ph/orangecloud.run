import { DurableObject } from "cloudflare:workers";
import { Files } from "@cloudflare/sandbox";

const INACTIVITY_MS = 10 * 60 * 1000;
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
    try {
      const process = await container.exec(argv, {
        cwd: "/workspace",
        signal: AbortSignal.timeout(20_000),
      });
      const output = await process.output();
      return {
        exitCode: output.exitCode,
        stdout: decode(output.stdout),
        stderr: decode(output.stderr),
      };
    } finally {
      await files.remove(path).catch(() => {});
    }
  }
}
