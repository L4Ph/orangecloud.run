import { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Hono } from "hono";
import * as v from "valibot";
import { docs } from "../docs";
import { docBody } from "../docs/bodies";
import { lessons } from "../lessons";
import { lessonDoc } from "../lessons/docs";
import { catalogs } from "../lib/catalogs";
import type { Locale } from "../lib/locales";
import { parseDoc, tocOf } from "../lib/markdown-source";
import { requestLocale } from "../lib/request-locale";
import { runInSandbox } from "../lib/run";
import { renderPage } from "./document";

// A Worker's named exports are its Durable Object classes and the sandbox's bindings.
export { LessonCounterDurableObject } from "../durable-objects/counter";
export { SandboxV1 } from "../durable-objects/sandbox";
export { LessonUserDoDurableObject } from "../durable-objects/user-do";
export * from "../lib/lesson-bindings";

const translator = (locale: Locale) =>
  new I18n({ locale, messages: { [locale]: catalogs[locale] } });

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/", (c) => {
  const locale = requestLocale(c);
  return c.html(
    renderPage({ name: "Home", props: { locale } }, { title: translator(locale)._(msg`学ぶ`) }),
  );
});

app.get("/books", (c) => {
  const locale = requestLocale(c);
  return c.html(
    renderPage(
      { name: "Books", props: { locale } },
      { title: translator(locale)._(msg`書籍の紹介`) },
    ),
  );
});

app.get("/lessons", (c) => c.redirect("/"));
app.get("/docs", (c) => c.redirect("/"));

app.get("/docs/:slug", (c) => {
  const doc = docs.find((item) => item.slug === c.req.param("slug"));
  if (!doc) return c.notFound();

  const locale = requestLocale(c);
  const i18n = translator(locale);
  const document = parseDoc(docBody(locale, doc.slug));

  return c.html(
    renderPage(
      { name: "Doc", props: { locale, slug: doc.slug, document, headings: tocOf(document) } },
      {
        title: i18n._(doc.title),
        meta: [
          { name: "description", content: i18n._(doc.summary) },
          { property: "og:title", content: i18n._(doc.title) },
          { property: "og:description", content: i18n._(doc.summary) },
        ],
      },
    ),
  );
});

app.get("/lessons/:id", (c) => {
  const lesson = lessons.find((item) => item.id === c.req.param("id"));
  if (!lesson) return c.notFound();

  const locale = requestLocale(c);
  const i18n = translator(locale);

  return c.html(
    renderPage(
      {
        name: "Lesson",
        props: {
          locale,
          lessonId: lesson.id,
          document: parseDoc(lessonDoc(locale, lesson.id)),
        },
      },
      {
        title: i18n._(lesson.title),
        meta: [
          { name: "description", content: i18n._(lesson.summary) },
          { property: "og:title", content: i18n._(lesson.title) },
          { property: "og:description", content: i18n._(lesson.summary) },
        ],
      },
    ),
  );
});

const runRequest = v.object({
  code: v.pipe(v.string(), v.minLength(1), v.maxLength(64 * 1024)),
  lang: v.optional(v.picklist(["javascript", "python", "container", "durable-object"])),
  runtime: v.optional(v.picklist(["python", "node", "sh"])),
});

app.post("/api/run", async (c) => {
  const input: unknown = await c.req.json().catch(() => undefined);
  const parsed = v.safeParse(runRequest, input);
  if (!parsed.success) return c.json({ error: "Invalid request" }, 400);
  const body = parsed.output;

  // There are no accounts, so the client IP is the only stable key. Cloudflare
  // always sets this header; the fallback only matters in local development.
  const key = c.req.header("cf-connecting-ip") ?? "local";
  const { RUN_LIMITER, CONTAINER_LIMITER, LOADER } = c.env;

  // Containers and Durable Object storage are the paths that cost real money.
  const costly = body.lang === "container" || body.lang === "durable-object";
  const allowed =
    (await RUN_LIMITER.limit({ key })).success &&
    (!costly || (await CONTAINER_LIMITER.limit({ key })).success);
  if (!allowed) {
    return c.json({ error: "Rate limit exceeded" }, 429, { "retry-after": "60" });
  }

  return c.json(await runInSandbox({ LOADER }, body.code, body.lang, body.runtime));
});

export default app;
