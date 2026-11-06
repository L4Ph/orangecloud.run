import { defineHandler } from 'void';
import { z } from 'zod';
import { env } from 'void/env';
import { runInSandbox, type RunResult } from '../../lib/run';

// Cloudflare's published test secrets accept any token, so they skip the
// hostname/action checks that a real secret relies on.
const TEST_SECRET_PREFIX = '1x0000000000000000000000000000000';

async function verifyTurnstile(token: string, hostname: string, remoteip: string | undefined) {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (remoteip) body.set('remoteip', remoteip);

  let result: { success?: boolean; action?: string; hostname?: string };
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    result = await response.json();
  } catch {
    return false;
  }

  if (result.success !== true) return false;
  if (env.TURNSTILE_SECRET.startsWith(TEST_SECRET_PREFIX)) return true;
  return result.action === 'run' && result.hostname === hostname;
}

export const POST = defineHandler.withValidator({
  body: z.object({
    code: z.string().min(1).max(64 * 1024),
    token: z.string().min(1).max(2048),
  }),
})(async (c, { body }): Promise<RunResult> => {
  const verified = await verifyTurnstile(
    body.token,
    new URL(c.req.url).hostname,
    c.req.header('cf-connecting-ip'),
  );
  if (!verified) {
    return {
      status: 0,
      body: '',
      logs: [],
      error: 'Turnstile verification failed',
      errorCode: 'turnstile',
      ms: 0,
    };
  }

  return runInSandbox(c.env, body.code);
});
