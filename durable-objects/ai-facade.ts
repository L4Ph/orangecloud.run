import { DurableObject } from 'cloudflare:workers';
import { defineDurableObject } from 'void/durable';
import { ai } from 'void/ai';

// The Ai binding is not transferable into a Dynamic Worker; proxy it.
class AiFacade extends DurableObject {
  async run(model: string, input: Record<string, unknown>) {
    return ai.run(model as never, input as never);
  }
}

export const AiFacadeResource = defineDurableObject({
  name: 'lesson-ai',
  class: AiFacade,
});
export default AiFacadeResource;
