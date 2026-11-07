# AI Gateway

Designs that expose external LLM providers or Workers AI directly from frontends or backends reveal vulnerabilities the moment they enter the operational phase. Sudden outages of upstream APIs, wasted billing from duplicate requests for the same prompt, and excessive token consumption by malicious users—there are limits to how much these can be handled by individual logic within the application code.

The AI Gateway is a **reverse proxy placed immediately before model calls**. It does not perform inference itself; instead, it centrally mediates communication to OpenAI, Anthropic, Google Gemini, and Workers AI, providing observability and a cost barrier.

## Five Barriers Provided

1. **Request Logs**: By default, records the prompt, response, provider, model, token counts, cost, and duration on a dashboard. To tell callers apart, attach custom metadata (up to 5 entries per request) such as `user_id`. The number of logs kept and how long they are kept are both limited.
2. **Exact Match Caching**: A request whose provider, endpoint, model, authentication header, and request body all match an earlier one is answered from Cloudflare's cache. A call that hits the cache is not sent to the provider, so it incurs no token charge and saves the round trip. Caching is disabled by default and is turned on in the gateway settings. Semantic caching, which would also match prompts with similar meaning, is not available yet; Cloudflare only plans to add it.
3. **Rate Limiting**: Applies a single limit to the whole gateway, set as a number of requests per interval (fixed window or sliding window). Requests over the limit receive a 429. To limit per user, use the Rate Limit node of a dynamic route (a routing feature that can combine conditional branches and limits) and specify a key such as `metadata.user_id`.
4. **Retries and Fallbacks**: Failed requests can be retried up to 5 times (delay up to 60 seconds; backoff constant, linear, or exponential). When a preferred model fails with an error or a timeout, you define the fallback targets and their order yourself with a dynamic route or a model alias (a feature that lets you call several models under one name).
5. **Spend Limits**: When the cumulative cost within a fixed or rolling period reaches the limit, the gateway blocks requests with a 429. Budgets can be split by provider, model, or metadata (such as a user ID). Costs are estimates, so a burst of concurrent requests can briefly exceed the limit.

## Implementation Method

No special SDK is required for deployment. Point existing API clients or `fetch` calls at the AI Gateway's endpoint URL and send the gateway's authentication token in the `cf-aig-authorization` header. Newly created gateways require authentication.

```js
const response = await fetch(
  `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/anthropic/v1/messages`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2026-10-21",
      "cf-aig-authorization": `Bearer ${env.CF_AIG_TOKEN}`,
    },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 256,
      messages: [{ role: "user", content: "Please summarize the features of Workers." }],
    }),
  },
);
```

## Design Principles for Reducing Costs

- **Fix default values to the smallest/cheapest model**: Do not assign the highest-performance model to every request; instead, use flags to switch only for specific functions requiring advanced inference.
- **Input text length validation**: Do not pass massive text sent from the client directly to the provider; limit the character count or token count before the Worker.
- **Be mindful of cache time-to-live (TTL)**: For uses where the same request repeats and real-time freshness is not needed, set longer cache durations so the edge can answer immediately.
