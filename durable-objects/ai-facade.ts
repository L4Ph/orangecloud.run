import { DurableObject } from 'cloudflare:workers';
import { defineDurableObject } from 'void/durable';
import { ai } from 'void/ai';

// The Ai binding is not transferable into a Dynamic Worker; proxy it.
class AiFacade extends DurableObject {
  async run(model: string, input: Record<string, unknown>) {
    try {
      return await ai.run(model as never, input as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Not available|authentication|unauthorized/i.test(message)) {
        throw new Error(
          'Workers AI に接続できません。ローカル開発では `void cloudflare login` が必要です（デプロイ後は不要）。',
        );
      }
      throw error;
    }
  }
}

export const AiFacadeResource = defineDurableObject({
  name: 'lesson-ai',
  class: AiFacade,
});
export default AiFacadeResource;
