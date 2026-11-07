# AI Gateway

站在模型 API **前面的关卡**。它不做推理，而是把发往 OpenAI、Anthropic、Gemini、Workers AI 等的调用汇聚到一个 URL，并加上日志、缓存、限制和回退。

## 好处

- **日志**：谁用了哪个模型、花了多少 token，全都留下
- **缓存**：相同的提示直接命中缓存（省钱）
- **限流**：每用户每分钟 N 次，等等
- **回退**：便宜模型失败时切到别的模型
- **成本控制**：预算告警与上限

## 两种用法

1. **替换服务商 URL**：`https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway}/openai/chat/completions`
2. **通过 Workers 的 `ai` 绑定调用**（想经过 Gateway 时使用第 1 种的 URL）

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

## 让大家都用得起的窍门

- 默认用最便宜的模型，强模型只放在明确的按钮后面
- 打开缓存，同一个问题不要付两次钱
- 有认证时按用户限流，没有认证时按 IP
- 在服务端截断输入，不要把长文原样转发
- 提前决定回退目标

本章仅为资料（需要先在你的账号配置 Gateway 并有 API 密钥）。
