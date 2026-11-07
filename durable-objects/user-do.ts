import { DurableObject } from "cloudflare:workers";
import { defineDurableObject } from "void/durable";

// Runs a Durable Object class written by the learner as a facet of this
// supervisor. The facet has its own SQLite database that survives code edits;
// aborting it on a code change throws its in-memory state away, which is what
// the chapter demonstrates.
class UserDO extends DurableObject<{ LOADER: WorkerLoader }> {
  #loaded: string | null = null;

  async run(id: string, code: string) {
    if (this.#loaded !== null && this.#loaded !== id) {
      this.ctx.facets.abort("app", new Error("code changed"));
    }
    this.#loaded = id;

    const facet = this.ctx.facets.get("app", () => {
      const worker = this.env.LOADER.get(id, () => ({
        compatibilityDate: "2026-02-24",
        mainModule: "app.js",
        modules: { "app.js": code },
        globalOutbound: null,
        limits: { cpuMs: 100, subRequests: 0 },
      }));
      return { class: worker.getDurableObjectClass("App") };
    });
    const response = await facet.fetch(new Request("https://sandbox.internal/"));
    return { status: response.status, body: await response.text() };
  }
}

export const UserDOResource = defineDurableObject({
  name: "lesson-user-do",
  class: UserDO,
});
export default UserDOResource;
