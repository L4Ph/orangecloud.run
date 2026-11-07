# Workers AI

在尝试将大规模语言模型或图像生成模型集成到后端时，最大的头疼问题在于 GPU 基础设施的保障以及按量计费成本的失控。如果租用专用实例，闲置时的固定成本将消失；而如果依赖大型 AI API，则会面临代币计费与通信延迟的双重困扰。

Workers AI 消除了推断服务器的置备和 API 密钥管理的需求。只需在 Workers 内部调用几行代码，即可直接在 Cloudflare 部署于全球各地数据中心的无服务器 GPU 集群上执行推断。

## 主要模型特性与成本对比

在选择模型时，最关键的是“输出代币单价”而非输入代币数量。因为计费的大部分取决于生成文本的长度。

| 模型名称 | 主要用途 | 特点与成本感 |
| --- | --- | --- |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 通用对话、摘要、翻译 | 输出 $0.555/1M 代币。日语准确率与成本的平衡最佳 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 英语文本处理、极小任务 | 输出 $0.112/1M 代币。极其低廉，但日语响应准确率显著逊色 |
| `@cf/openai/gpt-oss-20b` | 逻辑推理、复杂思考步骤 | 因消耗大量思考用代币，总成本容易偏高 |
| `@cf/baai/bge-small-en-v1.5` | 向量嵌入（RAG） | 用于构建搜索引擎。价格极低且速度快 |
| `@cf/openai/whisper` | 语音转录 | 根据语音时长按量计费 |

## 注意响应格式的差异

需要注意的是，不同模型返回的对象形状有所不同。

像 `mistral-small-3.1-24b` 这样的轻量级模型，会直接将字符串本身作为结果对象的 `.response` 属性返回。而推断特化模型（如 gpt-oss 等）通常采用与 OpenAI 兼容的 `.choices[0].message.content` 结构。建议先从返回 `.response` 的简单模型开始尝试，这样最不容易犹豫。

```js
const answer = await env.AI.run('@cf/mistralai/mistral-small-3.1-24b-instruct', {
  messages: [
    { role: 'system', content: '请用日语在 40 个字符以内简明地回答。' },
    { role: 'user', content: '请用一句话概括 Cloudflare Workers 的优点' },
  ],
  max_tokens: 80,
});

console.log(answer.response); // 生成的文本字符串
```

- 如果希望将响应逐次流式传输至浏览器，请指定 `{ stream: true }` 将其作为 Server-Sent Events（SSE）处理。
- 在生产环境中，为了防止因无限制调用导致计费事故，标准做法是在前端部署 **AI Gateway**，以强制执行缓存和速率限制。
