import { DurableObject } from 'cloudflare:workers';
import { defineDurableObject } from 'void/durable';

// A real Durable Object with SQLite-backed storage: one instance per name,
// serialized method calls, state that survives requests.
class Counter extends DurableObject {
  async increment() {
    const next = ((await this.ctx.storage.get<number>('count')) ?? 0) + 1;
    await this.ctx.storage.put('count', next);
    return next;
  }
  async read() {
    return (await this.ctx.storage.get<number>('count')) ?? 0;
  }
}

export const CounterResource = defineDurableObject({
  name: 'lesson-counter',
  class: Counter,
});
export default CounterResource;
