import { DurableObject } from "cloudflare:workers";
import { defineDurableObject } from "void/durable";
import { storage } from "void/storage";

// R2Bucket is not transferable into a Dynamic Worker. Text-only facade keeps
// results cloneable across the RPC boundary.
class R2Facade extends DurableObject {
  async get(key: string) {
    return (await storage.get(key))?.text() ?? null;
  }
  async put(key: string, value: string) {
    await storage.put(key, value);
  }
  async delete(key: string) {
    await storage.delete(key);
  }
  async list(prefix = "") {
    const result = await storage.list({ prefix });
    return result.objects.map((object) => `${object.key} (${object.size}B)`);
  }
}

export const R2FacadeResource = defineDurableObject({
  name: "lesson-r2",
  class: R2Facade,
});
export default R2FacadeResource;
