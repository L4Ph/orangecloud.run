# Workers AI

When attempting to integrate large language models or image generation models into your backend, the biggest headaches are securing GPU infrastructure and spiraling usage costs. Renting dedicated instances means fixed costs keep accruing even during idle periods, while relying on major AI APIs exposes you to the double burden of token charges and communication latency.

Workers AI eliminates the need for inference server provisioning and API key management. You can execute inference directly from within Workers by calling just a few lines of code against serverless GPU clusters deployed by Cloudflare across data centers worldwide.

## Key Model Characteristics and Cost Comparison

Models charge different token prices for input and for output. The cost is "input tokens × input price + output tokens × output price," so input dominates for long prompts such as summarization and RAG, and output dominates when the output is long, as in text generation and reasoning. For example, `mistral-small-3.1-24b-instruct` costs $0.351 for input and $0.555 for output (per 1M tokens); with 2,000 input tokens and 200 output tokens, about 86% of the cost is input.

| Model Name                                     | Primary Use                                      | Characteristics & Cost Range (prices per 1M tokens)                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | General conversation, summarization, translation | Input $0.351, output $0.555. 128,000-token context; supports function calling                                                                             |
| `@cf/ibm-granite/granite-4.0-h-micro`          | Lightweight tasks, function calling              | Input $0.017, output $0.112. Extremely cheap. Officially supports 12 languages including Japanese, but performance is not necessarily on par with English |
| `@cf/openai/gpt-oss-20b`                       | Logical reasoning, complex thought steps         | Input $0.200, output $0.300. Reasoning effort can be set to low / medium / high                                                                           |
| `@cf/baai/bge-small-en-v1.5`                   | Vector embeddings (English)                      | English only; input $0.020. For Japanese documents, use `@cf/baai/bge-m3` ($0.012) or `@cf/pfnet/plamo-embedding-1b` ($0.019)                             |
| `@cf/openai/whisper`                           | Audio transcription                              | About $0.0005 per audio minute                                                                                                                            |

## Note the Differences in Response Format

Be aware that the shape of the returned object varies by model.

Some models, such as `mistral-small-3.1-24b-instruct`, return the string itself directly in the `.response` property of the result object. Others, such as `gemma-4-26b-a4b-it`, return the OpenAI-compatible `.choices[0].message.content` structure. Which one applies differs per model, so check the output schema on the page of the model you use. Starting with straightforward models that return `.response` is the safest approach.

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
- Billing is in Neurons (a unit that measures GPU compute regardless of model). Up to 10,000 Neurons per day are free on both Workers Free and Paid; beyond that, Workers Paid charges $0.011 per 1,000 Neurons.
- In production environments, the standard practice is to insert an **AI Gateway** upstream (pass `{ gateway: { id: "your-gateway" } }` as the third argument of `env.AI.run()`) and configure caching and rate limiting to prevent billing issues caused by unlimited calls.
