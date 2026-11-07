# AI Gateway

A **checkpoint in front of a model API**. It does not run inference. It funnels calls to OpenAI, Anthropic, Gemini, Workers AI, and others through one URL and adds logging, caching, limits, and fallbacks.

## What you get

- **Logs**: who used which model, how many tokens, all recorded
- **Cache**: identical prompts come back from cache (cheaper)
- **Rate limits**: N calls per minute per user, and so on
- **Fallbacks**: if the cheap model fails, use another
- **Cost control**: budget alerts and caps

## Two ways to use it

1. **Swap the provider URL**: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway}/openai/chat/completions`
2. **Call it through the Workers `ai` binding** (use the URL from option 1 when you want the Gateway in front)

```js
const res = await fetch(
  `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/anthropic/v1/messages`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY },
    body: JSON.stringify({ model: 'claude-3-5-haiku', max_tokens: 200, messages: [...] }),
  },
);
```

## Keeping it cheap for everyone

- Default to the cheapest model; bigger models only behind an explicit action
- Turn on caching so the same question is never billed twice
- Rate limit per user when you have auth, per IP when you don't
- Truncate input server-side; do not forward long text as-is
- Decide the fallback target before you need it

This chapter is reference only (it needs a Gateway configured on your account plus an API key).
