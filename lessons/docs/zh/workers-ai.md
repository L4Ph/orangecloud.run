# Workers AI

在 Cloudflare 的 GPU 上运行模型。**既不用自己维护推理引擎，也不用管理 GPU**，只传模型名和输入。Serverless，按用量计费。

## 先从便宜的模型开始

| 模型                                       | 用途              | 大致费用     |
| ------------------------------------------ | ----------------- | ------------ |
| `@cf/meta/llama-3.1-8b-instruct`           | 通用对话与摘要    | 便宜。先用它 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 更难的推理        | 贵           |
| `@cf/baai/bge-small-en-v1.5`               | 向量（检索、RAG） | 非常便宜     |
| `@cf/openai/whisper`                       | 语音转文字        | 按秒计费     |

价格按输入与输出 token 计费。用便宜模型时单次不到一日元。先用 8B，不够再升级。

## 调用方式

```js
const answer = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
  messages: [
    { role: 'system', content: '回答要简短。' },
    { role: 'user', content: '一句话说明 Cloudflare Workers' },
  ],
});
answer.response; // 字符串
```

- `stream: true` 可流式输出（SSE）
- 向量：`env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [...] })`，存进 Vectorize 即可检索
- 图像生成、语音识别、翻译都用同一个 `run()`

## 本环境的注意点

**调用费用由本站承担。** 不需要 API 密钥（Workers AI 的绑定本身就是凭证）。

但 Workers AI 没有本地模拟器，用 `npm run dev` 尝试时需要先登录 Cloudflare。遇到认证错误就执行 `npx wrangler login` 再试。部署后任何人都能直接用。

公开前别忘了限制调用次数并固定使用便宜模型。把下一章的 **AI Gateway** 放在前面，就能一次性获得缓存、限流和费用可视化。
