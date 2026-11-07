# Workers AI

When attempting to integrate large language models or image generation models into your backend, the biggest headaches are securing GPU infrastructure and spiraling usage costs. Renting dedicated instances eliminates fixed costs even during idle periods, while relying on major AI APIs exposes you to the double burden of token charges and communication latency.

Workers AI eliminates the need for inference server provisioning and API key management. You can execute inference directly from within Workers by calling just a few lines of code against serverless GPU clusters deployed by Cloudflare across data centers worldwide.

## Key Model Characteristics and Cost Comparison

The most important factor in model selection is the "unit cost per output token" rather than the input token count. This is because the majority of the billing is based on the length of the generated text.

| Model Name                                     | Primary Use                                      | Characteristics & Cost Range                                                                    |
| ---------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | General conversation, summarization, translation | Output $0.555/1M tokens. Best balance of Japanese accuracy and cost                             |
| `@cf/ibm-granite/granite-4.0-h-micro`          | English text processing, ultra-small tasks       | Output $0.112/1M tokens. Extremely cheap, but Japanese response accuracy is significantly lower |
| `@cf/openai/gpt-oss-20b`                       | Logical reasoning, complex thought steps         | Consumes a large amount of thinking tokens, so total costs tend to be high                      |
| `@cf/baai/bge-small-en-v1.5`                   | Vector embeddings (RAG)                          | For building search engines. Extremely low-cost and fast                                        |
| `@cf/openai/whisper`                           | Audio transcription                              | Pay-as-you-go based on seconds of audio                                                         |

## Note the Differences in Response Format

Be aware that the shape of the returned object varies by model.

Lightweight models like `mistral-small-3.1-24b` return the string itself directly in the `.response` property of the result object. On the other hand, inference-specialized models (such as gpt-oss) often use the OpenAI-compatible `.choices[0].message.content` structure. Starting with straightforward models that return `.response` is the safest approach.

```js
const answer = await env.AI.run("@cf/mistralai/mistral-small-3.1-24b-instruct", {
  messages: [
    { role: "system", content: "Please answer concisely in Japanese within 40 characters." },
    { role: "user", content: "The benefits of Cloudflare Workers in one sentence" },
  ],
  max_tokens: 80,
});

console.log(answer.response); // Generated text string
```

- If you want to stream responses sequentially to the browser, specify `{ stream: true }` to treat them as Server-Sent Events (SSE).
- In production environments, the standard practice is to insert an **AI Gateway** upstream to enforce caching and rate limiting to prevent billing issues caused by unlimited calls.
