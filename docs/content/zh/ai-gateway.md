# AI Gateway

将外部 LLM 提供商或 Workers AI 直接从前端或后端调用的设计，一旦进入运维阶段就会暴露出漏洞。上游 API 的突发故障、针对同一提示词的重复请求导致的费用浪费，以及恶意用户的过度 Token 消耗——仅靠应用程序代码层面的独立逻辑来应对这些问题是有极限的。

AI Gateway 是一个**部署在模型调用之前的反向代理**。它不执行推理处理本身，而是统一中介发往 OpenAI、Anthropic、Google Gemini 和 Workers AI 的通信，提供可观测性和成本防护。

## 提供的 5 大防护机制

1. **完整的请求审计**：将哪个账户在何时针对哪个模型消耗了多少 Token 的全部历史记录记录在仪表盘中。
2. **语义性与完全匹配缓存**：将针对同一提示词和参数的推理结果缓存在边缘端，使第二次及之后的调用无需经过提供商即可在毫秒级别返回。可同时将 Token 计费和通信时间降低至零。
3. **细粒度速率限制**：按用户或 IP 单位强制执行每分钟的次数上限，在滚动循环或机器人导致的计费事故发生前将其拦截。
4. **自动回退与重试**：当优先模型（例如：低成本模型）返回 500 错误时，透明地将请求转发至替代提供商的模型。
5. **预算上限与告警**：设置失败安全机制，在月费达到指定金额时自动拒绝调用。

## 部署方法

部署时不需要特殊的 SDK。只需将现有的 API 客户端或 `fetch` 调用的目标替换为 AI Gateway 的端点 URL 即可完成。

```js
const response = await fetch(
  `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/anthropic/v1/messages`,
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      messages: [{ role: 'user', content: 'Workers の特徴を要約してください。' }],
    }),
  },
);
```

## 降低成本的设计原则

- **默认值固定为最小、最便宜的模型**：不要为所有请求分配最高性能的模型，而仅针对需要高级推理的特定功能通过标志进行切换。
- **输入文本长度上限验证**：不要将客户端发送的巨大文本原封不动地传输给提供商，而是在 Workers 之前截断字符数或 Token 数量。
- **关注缓存生命周期（TTL）**：对于不需要实时性的分析或摘要任务，设置较长的缓存，使其能从边缘端立即返回答案。
