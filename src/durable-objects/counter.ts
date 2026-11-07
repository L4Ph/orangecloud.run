import { DurableObject } from "cloudflare:workers";

// Anyone can reach this counter, so its storage must not outlive its use: after a
// day with no calls an alarm deletes it, and an object with no data and no alarm
// is not billed.
const IDLE_MS = 24 * 60 * 60 * 1000;

// A real Durable Object with SQLite-backed storage: one instance per name,
// serialized method calls, state that survives requests.
export class LessonCounterDurableObject extends DurableObject {
  async increment() {
    const next = ((await this.ctx.storage.get<number>("count")) ?? 0) + 1;
    await this.ctx.storage.put("count", next);
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
    return next;
  }
  async read() {
    return (await this.ctx.storage.get<number>("count")) ?? 0;
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
