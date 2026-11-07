import { defineHandler } from 'void';
import { z } from 'zod';
import { env } from 'void/env';
import { runInSandbox, type RunResult } from '../../lib/run';

// Cloudflare's published test secrets accept any token, so they skip the
// hostname/action checks that a real secret relies on.
const TEST_SECRET_PREFIX = '1x0000000000000000000000000000000';

// One verified visit per browser per half day; tokens are single-use, so
// re-running the widget for every click is user-hostile.
const PASS_COOKIE = 'run_pass';
const PASS_TTL_MS = 12 * 60 * 60 * 1000;

const encode = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.TURNSTILE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return encode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

async function issuePass() {
  const expires = Date.now() + PASS_TTL_MS;
  return `${expires}.${await hmac(String(expires))}`;
}

async function hasValidPass(cookieHeader: string | undefined) {
  const raw = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PASS_COOKIE}=`))
    ?.slice(PASS_COOKIE.length + 1);
  if (!raw) return false;

  const [expires, signature] = raw.split('.');
  if (!expires || !signature) return false;
  if (Number(expires) < Date.now()) return false;
  return signature === (await hmac(expires));
}

async function verifyTurnstile(token: string, hostname: string, remoteip: string | undefined) {
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (remoteip) form.set('remoteip', remoteip);

  let result: { success?: boolean; action?: string; hostname?: string };
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
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
    code: z
      .string()
      .min(1)
      .max(64 * 1024),
    token: z.string().min(1).max(2048).optional(),
  }),
})(async (c, { body }): Promise<RunResult | Response> => {
  const passed = await hasValidPass(c.req.header('cookie'));
  let setCookie: string | null = null;

  if (!passed) {
    if (!body.token) {
      return {
        status: 0,
        body: '',
        logs: [],
        error: 'Turnstile verification required',
        errorCode: 'turnstile',
        ms: 0,
      };
    }

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

    setCookie = `${PASS_COOKIE}=${await issuePass()}; Path=/; Max-Age=${PASS_TTL_MS / 1000}; HttpOnly; Secure; SameSite=Lax`;
  }

  const { LOADER, DB, LESSON_KV, LESSON_R2, LESSON_AI, LESSON_COUNTER } = c.env;
  const result = await runInSandbox(
    { LOADER, DB, LESSON_KV, LESSON_R2, LESSON_AI, LESSON_COUNTER },
    body.code,
  );

  if (!setCookie) return result;

  // Returning a Response keeps the cookie: Void builds one from a plain object
  // and drops headers set on the context.
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': setCookie },
  });
});
