# AI Gateway

Designs that expose external LLM providers or Workers AI directly from frontends or backends reveal vulnerabilities the moment they enter the operational phase. Sudden outages of upstream APIs, wasted billing from duplicate requests for the same prompt, and excessive token consumption by malicious users—there are limits to how much these can be handled by individual logic within the application code.

The AI Gateway is a **reverse proxy placed immediately before model calls**. It does not perform inference itself; instead, it centrally mediates communication to OpenAI, Anthropic, Google Gemini, and Workers AI, providing observability and a cost barrier.

## Five Barriers Provided

1. **Complete Request Auditing**: Records the full history of which account consumed how many tokens for which model and when on a dashboard.
2. **Semantic Exact Match Caching**: Caches inference results for the same prompt and parameters at the edge, returning them in milliseconds for subsequent calls without routing them through the provider. This reduces both token billing and communication time to zero simultaneously.
3. **Fine-Grained Rate Limiting**: Enforces per-user or per-IP limits on executions per minute, blocking billing incidents caused by bots or runaway loops at the source.
4. **Automatic Fallback and Retry**: When a preferred model (e.g., a low-cost model) returns a 500 error, it transparently forwards the request to a model from an alternative provider.
5. **Budget Caps and Alerts**: Implements a fail-safe that automatically rejects calls once the monthly cost reaches a specified amount.

## Implementation Method

No special SDK is required for deployment. Implementation is as simple as replacing the target of existing API clients or `fetch` calls with the AI Gateway's endpoint URL.

```js
const response = await fetch(
  `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/anthropic/v1/messages`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 256,
      messages: [{ role: "user", content: "Please summarize the features of Workers." }],
    }),
  },
);
```

## Design Principles for Reducing Costs

- **Fix default values to the smallest/cheapest model**: Do not assign the highest-performance model to every request; instead, use flags to switch only for specific functions requiring advanced inference.
- **Input text length validation**: Do not pass massive text sent from the client directly to the provider; limit the character count or token count before the Worker.
- **Be mindful of cache time-to-live (TTL)**: Set longer cache durations for analysis or summarization tasks that do not require real-time performance, ensuring immediate responses from the edge.
