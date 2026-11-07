# Workers AI

Models running on Cloudflare's GPUs. **You own neither the inference engine nor the GPUs**; you pass a model name and an input. It is serverless, so you pay only for what you use.

## Start with a cheap model

| Model                                          | Use                        | Rough cost        |
| ---------------------------------------------- | -------------------------- | ----------------- |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | General chat and summaries | Cheap. Start here |
| `@cf/openai/gpt-oss-20b`                       | Harder reasoning           | Expensive         |
| `@cf/baai/bge-small-en-v1.5`                   | Embeddings (search, RAG)   | Very cheap        |
| `@cf/openai/whisper`                           | Speech to text             | Billed per second |

Pricing is per input and output token. With a cheap model a call is well under a yen. Run the cheap model first and only step up when it is not enough.

Models churn. Check the [Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/) for the current ID and any planned deprecation before you ship — the IDs above will eventually disappear too.

Output tokens usually dominate the bill, so compare output pricing: `mistral-small-3.1-24b` is $0.555 per M output tokens, about four times cheaper than llama-3.3-70b at $2.253, and it returns a string in `response`.

Models differ in shape. `@cf/mistralai/mistral-small-3.1-24b-instruct` returns a string in `response`, while reasoning models such as Gemma 4 answer in `choices[0].message.content` and spend many tokens thinking. Start with a `response` model.

## Calling it

```js
const answer = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
  messages: [
    { role: 'system', content: 'Answer briefly.' },
    { role: 'user', content: 'Cloudflare Workers in one sentence' },
  ],
});
answer.response; // a string
```

- `stream: true` streams (SSE)
- Embeddings: `env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [...] })`, then store them in Vectorize to search
- Image generation, speech recognition, and translation all go through the same `run()`

## In this environment

**This site pays for the calls.** No API key is needed, because the Workers AI binding is itself the credential.

Workers AI has no local simulator, so trying it with `npm run dev` needs a Cloudflare login. If you hit an auth error, run `npx wrangler login` and try again. After deploying, it works for anyone.

Before going public, cap the number of runs and pin a cheap model. Putting the next chapter's **AI Gateway** in front buys you caching, rate limiting, and cost visibility in one move.
