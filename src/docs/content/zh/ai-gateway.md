# AI Gateway

将外部 LLM 提供商或 Workers AI 直接从前端或后端调用的设计，一旦进入运维阶段就会暴露出漏洞。上游 API 的突发故障、针对同一提示词的重复请求导致的费用浪费，以及恶意用户的过度 Token 消耗——仅靠应用程序代码层面的独立逻辑来应对这些问题是有极限的。

AI Gateway 是一个**部署在模型调用之前的反向代理**。它不执行推理处理本身，而是统一中介发往 OpenAI、Anthropic、Google Gemini 和 Workers AI 的通信，提供可观测性和成本防护。

## 提供的 5 大防护机制

1. **请求日志**：默认会将提示词、响应、提供商、模型、Token 数、费用和耗时记录在仪表盘中。若要区分是谁发起的调用，可在自定义元数据（每个请求最多 5 条）中附上 `user_id` 等。可保存的日志数量和保存期限都有上限。
2. **完全匹配缓存**：对于提供商、端点、模型、认证头和请求正文全部一致的请求，直接从 Cloudflare 的缓存返回响应。命中缓存的调用不会发往提供商，因此不产生 Token 计费，也省去了往返通信。默认关闭，需要在网关设置中开启。对含义相近的提示词也生效的语义缓存，目前 Cloudflare 仅计划加入，尚不可用。
3. **速率限制**：对整个网关统一设置次数和时间间隔（固定窗口或滑动窗口）进行限制，超出限制的请求会收到 429。若要按用户限制，可在 dynamic route（可组合条件分支与限制的路由功能）的 Rate Limit 节点中，把 `metadata.user_id` 等指定为键。
4. **重试与回退**：失败的请求最多可重试 5 次（间隔最长 60 秒，退避方式为 constant、linear 或 exponential）。优先模型因错误或超时失败时，切换到哪个模型、按什么顺序，需要用 dynamic route 或 model alias（用一个名称调用多个模型的功能）自行定义。
5. **支出上限**：在固定或滚动的时间段内，累计费用达到上限后，网关会返回 429 并拦截请求。可按提供商、模型或元数据（如用户 ID）分别设置预算。费用是估算值，并发请求集中时可能会短暂超出上限。

## 部署方法

部署时不需要特殊的 SDK。只需将现有的 API 客户端或 `fetch` 调用的目标替换为 AI Gateway 的端点 URL，并把网关的认证令牌放在 `cf-aig-authorization` 请求头中。新创建的网关必须开启认证。

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
      messages: [{ role: "user", content: "请总结 Workers 的特点。" }],
    }),
  },
);
```

## 降低成本的设计原则

- **默认值固定为最小、最便宜的模型**：不要为所有请求分配最高性能的模型，而仅针对需要高级推理的特定功能通过标志进行切换。
- **输入文本长度上限验证**：不要将客户端发送的巨大文本原封不动地传输给提供商，而是在 Workers 之前截断字符数或 Token 数量。
- **关注缓存生命周期（TTL）**：对于同一请求反复出现、且不要求实时性的场景，设置较长的缓存，使其能从边缘端立即返回答案。
