import { exports } from "cloudflare:workers";

export type RunResult = {
  status: number;
  body: string;
  logs: string[];
  ms: number;
  error?: string;
};

// console is captured inside the sandbox; the wrapper always answers JSON so
// the API shape stays stable whatever the learner writes.
// Bump the version when the wrapper changes: it is part of the cache id.
const WRAPPER_VERSION = 3;
const wrap = () => `
import user from './user.js';
export default {
  async fetch(request, env, ctx) {
    // Must live inside fetch: a warm isolate keeps module scope across runs.
    const logs = [];
    const record = (...args) => logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    globalThis.console = { log: record, info: record, warn: record, error: record, debug: record };
    try {
      if (typeof user?.fetch !== 'function') {
        return Response.json({
          error: 'Write a module that exports default { fetch(request, env) { ... } }',
          logs,
        });
      }
      const res = await user.fetch(request, env, ctx);
      if (!(res instanceof Response)) {
        return Response.json({ error: 'Return a Response', logs });
      }
      return Response.json({ status: res.status, body: await res.text(), logs });
    } catch (error) {
      return Response.json({ error: error?.message ?? String(error), logs });
    }
  },
};
`;

// KV and R2 are shared with the app, so a lesson's keys live under this prefix.
const LESSON_SCOPE = { prefix: "playground/" };

// Dynamic Workers bill per unique (id, code) per day, so the id is derived from
// the code: every learner running an unedited snippet shares one worker, and a
// re-run costs nothing. Normalise only what cannot change behaviour.
const normalize = (code: string) => code.replace(/\r\n/g, "\n").replace(/\n+$/, "");

// The id picks which code runs: a Worker that is already loaded under an id is reused without
// looking at the code. A 32-bit hash is easy to collide on purpose, so use 128 bits of SHA-256.
const hash = async (text: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest).subarray(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

type SandboxEnv = Pick<Cloudflare.Env, "LOADER">;

export type RunLang = "javascript" | "python" | "container" | "durable-object";

// Containers are a separate runtime: a real filesystem, real binaries, no isolate.
export type ContainerRuntime = "python" | "node" | "sh";

const RUNTIMES: Record<ContainerRuntime, { ext: string; cmd: string }> = {
  python: { ext: "py", cmd: "python3" },
  node: { ext: "mjs", cmd: "node" },
  sh: { ext: "sh", cmd: "sh" },
};

async function runInContainer(code: string, runtime: ContainerRuntime): Promise<RunResult> {
  const { ext, cmd } = RUNTIMES[runtime];
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  try {
    const file = `run-${crypto.randomUUID()}.${ext}`;
    const sandboxes = exports.SandboxV1;
    const result = await sandboxes
      .get(sandboxes.idFromName("lesson-container"))
      .run([cmd, file], { name: file, content: code });
    return {
      status: result.exitCode,
      body: [result.stdout, result.stderr].filter(Boolean).join("\n").slice(0, 16_000),
      logs: [],
      ms: elapsed(),
    };
  } catch (error) {
    return {
      status: 0,
      body: "",
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      ms: elapsed(),
    };
  }
}

// A learner-written Durable Object class, run as a facet of a supervisor DO.
// The id changes with the code, so an edit restarts the facet (in-memory state
// resets) while its SQLite storage stays.
async function runInDurableObject(code: string): Promise<RunResult> {
  const started = performance.now();
  try {
    const supervisors = exports.LessonUserDoDurableObject;
    const { status, body } = await supervisors
      .get(supervisors.idFromName("lesson-user-do"))
      .run(`do-${await hash(normalize(code))}`, code);
    return { status, body, logs: [], ms: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      status: 0,
      body: "",
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      ms: Math.round(performance.now() - started),
    };
  }
}

export async function runInSandbox(
  env: SandboxEnv,
  code: string,
  lang: RunLang = "javascript",
  runtime: ContainerRuntime = "python",
): Promise<RunResult> {
  if (lang === "container") return runInContainer(code, runtime);
  if (lang === "durable-object") return runInDurableObject(code);
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  try {
    const wrapped = wrap();
    const python = lang === "python";
    const id = `${python ? "py" : "run"}-${WRAPPER_VERSION}-${await hash(normalize(code))}`;
    const modules: Record<string, string> = python
      ? { "worker.py": code }
      : { "index.js": wrapped, "user.js": code };
    const worker = env.LOADER.get(id, () => ({
      compatibilityDate: "2026-02-24",
      compatibilityFlags: python ? ["python_workers"] : undefined,
      mainModule: python ? "worker.py" : "index.js",
      modules,
      // The sandbox gets stubs of the classes in lesson-bindings.ts, nothing else.
      env: python
        ? {}
        : {
            KV: exports.LessonKv({ props: LESSON_SCOPE }),
            STORAGE: exports.LessonR2({ props: LESSON_SCOPE }),
            AI: exports.LessonAi({ props: {} }),
            COUNTER: exports.LessonCounter({ props: {} }),
            DB: exports.LessonDb({ props: {} }),
          },
      globalOutbound: null,
      // Every binding call is a subrequest; the network itself stays closed.
      limits: { cpuMs: 100, subRequests: python ? 0 : 20 },
    }));
    const response = await worker.getEntrypoint().fetch(new Request("https://sandbox.internal/"));

    if (python) {
      return {
        status: response.status,
        body: await response.text(),
        logs: [],
        ms: elapsed(),
      };
    }

    const result = await response.json<Partial<RunResult>>();
    return {
      status: result.status ?? 0,
      body: result.body ?? "",
      logs: result.logs ?? [],
      error: result.error,
      ms: elapsed(),
    };
  } catch (error) {
    return {
      status: 0,
      body: "",
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      ms: elapsed(),
    };
  }
}
