import { defineHandler } from 'void';
import { z } from 'zod';

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

type RunResult = {
  status: number;
  body: string;
  logs: string[];
  ms: number;
  error?: string;
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
        return Response.json({ error: 'export default { async fetch(request, env) { ... } } を書いてください', logs });
      }
      const res = await user.fetch(request, env, ctx);
      if (!(res instanceof Response)) {
        return Response.json({ error: 'Response を return してください', logs });
      }
      return Response.json({ status: res.status, body: await res.text(), logs });
    } catch (error) {
      return Response.json({ error: error?.message ?? String(error), logs });
    }
  },
};
`;

// Same code + same id is reused, so repeat runs skip isolate creation and are
// billed once per day rather than once per request.
const hash = (text: string) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

// Local dev rejects string ids on `get()`; resolving the id works everywhere.
const stub = (namespace: DurableObjectNamespace, name: string) =>
  namespace.get(namespace.idFromName(name));

export const POST = defineHandler.withValidator({
  body: z.object({ code: z.string().min(1).max(64 * 1024) }),
})(async (c, { body }): Promise<RunResult> => {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const wrapped = wrap();
    const id = `run-${WRAPPER_VERSION}-${hash(body.code)}`;
    const worker = c.env.LOADER.get(id, () => ({
      compatibilityDate: '2026-02-24',
      mainModule: 'index.js',
      modules: { 'index.js': wrapped, 'user.js': body.code },
      env: {
        KV: stub(c.env.LESSON_KV, 'lesson-kv'),
        STORAGE: stub(c.env.LESSON_R2, 'lesson-r2'),
        AI: stub(c.env.LESSON_AI, 'lesson-ai'),
        COUNTER: stub(c.env.LESSON_COUNTER, 'lesson-counter'),
        DB: c.env.DB,
      },
      globalOutbound: null,
      limits: { cpuMs: 100, subRequests: 0 },
    }));
    const response = await worker.getEntrypoint().fetch(new Request('https://sandbox.internal/'));
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
});
