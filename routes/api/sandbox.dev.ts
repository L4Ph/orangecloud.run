// Development-only entry point for `npm run smoke`: no Turnstile token exists
// outside a browser. Void excludes `.dev` routes from builds and deployments.
import { defineHandler } from 'void';
import { z } from 'zod';
import { runInSandbox } from '../../lib/run';

export const POST = defineHandler.withValidator({
  body: z.object({ code: z.string().min(1).max(64 * 1024) }),
})((c, { body }) => {
  const { LOADER, DB, LESSON_KV, LESSON_R2, LESSON_AI, LESSON_COUNTER } = c.env;
  return runInSandbox({ LOADER, DB, LESSON_KV, LESSON_R2, LESSON_AI, LESSON_COUNTER }, body.code);
});
