import { RpcTarget, WorkerEntrypoint } from "cloudflare:workers";
import * as v from "valibot";

// Custom bindings for the lesson sandbox (Dynamic Workers: "Bindings"). The sandbox's env
// holds only stubs of these classes, and each method call is an RPC back into this Worker,
// so a lesson can reach nothing but what is written here. src/server.tsx exports the
// classes from the Worker entry, which is what makes them available as `ctx.exports.*`.

type Scope = { prefix: string };

// KV and R2 are shared with the app, so a lesson's keys live under `props.prefix`.
export class LessonKv extends WorkerEntrypoint<Cloudflare.Env, Scope> {
  get(key: string) {
    return this.env.KV.get(this.#scoped(key));
  }

  async put(key: string, value: string | object) {
    await this.env.KV.put(
      this.#scoped(key),
      typeof value === "string" ? value : JSON.stringify(value),
    );
  }

  async delete(key: string) {
    await this.env.KV.delete(this.#scoped(key));
  }

  async list(prefix: string | { prefix?: string } = "") {
    const scope = this.ctx.props.prefix;
    const { keys } = await this.env.KV.list({
      prefix: this.#scoped(typeof prefix === "string" ? prefix : (prefix.prefix ?? "")),
    });
    return keys.map(({ name }) => name.slice(scope.length));
  }

  #scoped(key: string) {
    return this.ctx.props.prefix + key;
  }
}

export class LessonR2 extends WorkerEntrypoint<Cloudflare.Env, Scope> {
  async get(key: string) {
    return (await this.env.STORAGE.get(this.#scoped(key)))?.text() ?? null;
  }

  async put(key: string, value: string) {
    await this.env.STORAGE.put(this.#scoped(key), value);
  }

  async delete(key: string) {
    await this.env.STORAGE.delete(this.#scoped(key));
  }

  async list(prefix = "") {
    const scope = this.ctx.props.prefix;
    const { objects } = await this.env.STORAGE.list({ prefix: this.#scoped(prefix) });
    return objects.map((object) => `${object.key.slice(scope.length)} (${object.size}B)`);
  }

  #scoped(key: string) {
    return this.ctx.props.prefix + key;
  }
}

// Every model run is billed, so only the lesson's model is offered, with a small input.
const MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const chat = v.object({
  messages: v.pipe(
    v.array(
      v.object({
        role: v.picklist(["system", "user", "assistant"]),
        content: v.pipe(v.string(), v.maxLength(2_000)),
      }),
    ),
    v.maxLength(20),
  ),
  max_tokens: v.optional(v.pipe(v.number(), v.maxValue(256))),
});

export class LessonAi extends WorkerEntrypoint<Cloudflare.Env> {
  async run(model: string, input: unknown) {
    if (model !== MODEL) throw new Error(`Only ${MODEL} is available in the playground.`);
    try {
      return await this.env.AI.run(MODEL, v.parse(chat, input));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Not available|authentication|unauthorized/i.test(message)) {
        console.error("ai binding unavailable:", message);
        throw new Error("Workers AI is unavailable right now. Try again in a moment.");
      }
      throw error;
    }
  }
}

export class LessonCounter extends WorkerEntrypoint<Cloudflare.Env> {
  increment() {
    return this.#counter().increment();
  }

  read() {
    return this.#counter().read();
  }

  #counter() {
    const counters = this.ctx.exports.LessonCounterDurableObject;
    return counters.get(counters.idFromName("lesson-counter"));
  }
}

// `db.prepare(sql).bind(...).run()` chains calls, so each step returns another stub.
class LessonStatement extends RpcTarget {
  #statement: D1PreparedStatement;

  constructor(statement: D1PreparedStatement) {
    super();
    this.#statement = statement;
  }

  bind(...values: unknown[]) {
    return new LessonStatement(this.#statement.bind(...values));
  }

  run() {
    return this.#statement.run();
  }

  all() {
    return this.#statement.all();
  }

  raw() {
    return this.#statement.raw();
  }

  first(column?: string) {
    return column === undefined ? this.#statement.first() : this.#statement.first(column);
  }
}

export class LessonDb extends WorkerEntrypoint<Cloudflare.Env> {
  prepare(sql: string) {
    return new LessonStatement(this.env.DB.prepare(sql));
  }

  exec(sql: string) {
    return this.env.DB.exec(sql);
  }
}
