import { DurableObject } from "cloudflare:workers";
import { defineDurableObject } from "void/durable";
import { ai } from "void/ai";

// The Ai binding is not transferable into a Dynamic Worker; proxy it. The answer
// travels as JSON text because the RPC types only accept shapes they can prove
// serializable, and a model's answer has no fixed shape.
class AiFacade extends DurableObject {
  async run(model: string, input: Record<string, unknown>): Promise<string> {
    try {
      return JSON.stringify(await ai.run(model as never, input as never));
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

export const AiFacadeResource = defineDurableObject({
  name: "lesson-ai",
  class: AiFacade,
});
export default AiFacadeResource;
