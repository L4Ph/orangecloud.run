import { DurableObject } from 'cloudflare:workers';
import { defineDurableObject } from 'void/durable';
import { kv } from 'void/kv';

// A real KV namespace is not transferable into a Dynamic Worker, so the sandbox
// talks to it through this stub. Calls cost one request each; keep lessons small.
class KvFacade extends DurableObject {
  get(key: string) {
    return kv.get(key);
  }
  async put(key: string, value: string) {
    await kv.put(key, value);
  }
  async delete(key: string) {
    await kv.delete(key);
  }
  async list(prefix = '') {
    const result = await kv.list({ prefix });
    return result.keys.map((key) => key.name);
  }
}

export const KvFacadeResource = defineDurableObject({
  name: 'lesson-kv',
  class: KvFacade,
});
export default KvFacadeResource;
