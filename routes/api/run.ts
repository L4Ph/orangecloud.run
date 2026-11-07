import { defineHandler } from "void";
import * as v from "valibot";
import { runInSandbox, type RunResult } from "../../lib/run";

export const POST = defineHandler.withValidator({
  body: v.object({
    code: v.pipe(v.string(), v.minLength(1), v.maxLength(64 * 1024)),
    lang: v.optional(v.picklist(["javascript", "python", "container", "durable-object"])),
    runtime: v.optional(v.picklist(["python", "node", "sh"])),
  }),
})(async (c, { body }): Promise<RunResult | Response> => {
  // There are no accounts, so the client IP is the only stable key. Cloudflare
  // always sets this header; the fallback only matters in local development.
  const key = c.req.header("cf-connecting-ip") ?? "local";
  const { RUN_LIMITER, CONTAINER_LIMITER } = c.env;

  const allowed =
    (await RUN_LIMITER.limit({ key })).success &&
    (body.lang !== "container" || (await CONTAINER_LIMITER.limit({ key })).success);
  if (!allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  const { LOADER, DB, LESSON_KV, LESSON_R2, LESSON_AI, LESSON_COUNTER, LESSON_USER_DO } = c.env;
  return runInSandbox(
    { LOADER, DB, LESSON_KV, LESSON_R2, LESSON_AI, LESSON_COUNTER, LESSON_USER_DO },
    body.code,
    body.lang,
    body.runtime,
  );
});
