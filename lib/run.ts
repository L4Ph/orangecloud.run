declare global {
  interface VoidGeneratedEnvBindings {
    LOADER: WorkerLoader;
    LESSON_KV: DurableObjectNamespace;
    LESSON_R2: DurableObjectNamespace;
    LESSON_AI: DurableObjectNamespace;
    LESSON_COUNTER: DurableObjectNamespace;
    DB: D1Database;
  }
}

export type RunResult = {
  status: number;
  body: string;
  logs: string[];
  ms: number;
  error?: string;
  errorCode?: 'turnstile';
};

// console is captured inside the sandbox; the wrapper always answers JSON so
// the API shape stays stable whatever the learner writes.
// Bump the version when the wrapper changes: it is part of the cache id.
const WRAPPER_VERSION = 2;
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

// Dynamic Workers bill per unique (id, code) per day, so the id is derived from
// the code: every learner running an unedited snippet shares one worker, and a
// re-run costs nothing. Normalise only what cannot change behaviour.
const normalize = (code: string) => code.replace(/\r\n/g, '\n').replace(/\n+$/, '');

const hash = (text: string) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

// Local dev rejects string ids on `get()`; resolving the id works everywhere.
const stub = (namespace: DurableObjectNamespace, name: string) =>
  namespace.get(namespace.idFromName(name));

type SandboxEnv = {
  LOADER: WorkerLoader;
  LESSON_KV: DurableObjectNamespace;
  LESSON_R2: DurableObjectNamespace;
  LESSON_AI: DurableObjectNamespace;
  LESSON_COUNTER: DurableObjectNamespace;
  DB: D1Database;
};

export type RunLang = 'javascript' | 'python' | 'container';

import { getSandbox } from 'void/sandbox';

// Containers are a separate runtime: a real filesystem, real binaries, no isolate.
async function runInContainer(code: string): Promise<RunResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  try {
    const sandbox = await getSandbox('lesson-container');
    const file = `run-${crypto.randomUUID()}.py`;
    await sandbox.files.writeFile(`/workspace/${file}`, code);
    const result = await sandbox.run(['python3', file], {
      cwd: '/workspace',
      signal: AbortSignal.timeout(20_000),
    });
    await sandbox.files.remove(`/workspace/${file}`).catch(() => {});

    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);
    return {
      status: result.exitCode,
      body: [stdout, stderr].filter(Boolean).join('\n').slice(0, 16_000),
      logs: [],
      ms: elapsed(),
    };
  } catch (error) {
    return {
      status: 0,
      body: '',
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      ms: elapsed(),
    };
  }
}

export async function runInSandbox(
  env: SandboxEnv,
  code: string,
  lang: RunLang = 'javascript',
): Promise<RunResult> {
  if (lang === 'container') return runInContainer(code);
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  try {
    const wrapped = wrap();
    const python = lang === 'python';
    const id = `${python ? 'py' : 'run'}-${WRAPPER_VERSION}-${hash(normalize(code))}`;
    const modules: Record<string, string> = python
      ? { 'worker.py': code }
      : { 'index.js': wrapped, 'user.js': code };
    const worker = env.LOADER.get(id, () => ({
      compatibilityDate: '2026-02-24',
      compatibilityFlags: python ? ['python_workers'] : undefined,
      mainModule: python ? 'worker.py' : 'index.js',
      modules,
      env: {
        KV: stub(env.LESSON_KV, 'lesson-kv'),
        STORAGE: stub(env.LESSON_R2, 'lesson-r2'),
        AI: stub(env.LESSON_AI, 'lesson-ai'),
        COUNTER: stub(env.LESSON_COUNTER, 'lesson-counter'),
        DB: env.DB,
      },
      globalOutbound: null,
      limits: { cpuMs: 100, subRequests: 0 },
    }));
    const response = await worker.getEntrypoint().fetch(new Request('https://sandbox.internal/'));

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
      body: result.body ?? '',
      logs: result.logs ?? [],
      error: result.error,
      ms: elapsed(),
    };
  } catch (error) {
    return {
      status: 0,
      body: '',
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      ms: elapsed(),
    };
  }
}
