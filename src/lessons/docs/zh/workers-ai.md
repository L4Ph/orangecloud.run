# Workers AI

在尝试将大规模语言模型或图像生成模型集成到后端时，最大的头疼问题在于 GPU 基础设施的保障以及按量计费成本的失控。如果租用专用实例，闲置时也会持续产生固定成本；而如果依赖大型 AI API，则会面临 Token 计费与通信延迟的双重困扰。

Workers AI 消除了推断服务器的置备和 API 密钥管理的需求。只需在 Workers 内部调用几行代码，即可直接在 Cloudflare 部署于全球各地数据中心的无服务器 GPU 集群上执行推断。

## 主要模型特性与成本对比

不同模型的输入与输出 Token 单价各不相同。费用按“输入 Token 数 × 输入单价 + 输出 Token 数 × 输出单价”计算，因此提示词较长的摘要或 RAG 以输入为主，输出较长的文本生成或推理则以输出为主。例如 `mistral-small-3.1-24b-instruct` 的输入为 $0.351、输出为 $0.555（每 100 万 Token）；输入 2,000 Token、输出 200 Token 时，约 86% 的费用来自输入。

| 模型名称                                       | 主要用途               | 特点与成本感（单价为每 100 万 Token）                                                                          |
| ---------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 通用对话、摘要、翻译   | 输入 $0.351、输出 $0.555。上下文 128,000 Token，支持函数调用                                                   |
| `@cf/ibm-granite/granite-4.0-h-micro`          | 轻量任务、函数调用     | 输入 $0.017、输出 $0.112。极其低廉。正式支持包括日语在内的 12 种语言，但性能不一定与英语相当                   |
| `@cf/openai/gpt-oss-20b`                       | 逻辑推理、复杂思考步骤 | 输入 $0.200、输出 $0.300。可在 low / medium / high 中选择推理强度                                              |
| `@cf/baai/bge-small-en-v1.5`                   | 向量嵌入（英语）       | 仅支持英语，输入 $0.020。日语文档请使用 `@cf/baai/bge-m3`（$0.012）或 `@cf/pfnet/plamo-embedding-1b`（$0.019） |
| `@cf/openai/whisper`                           | 语音转录               | 每分钟音频约 $0.0005                                                                                           |

## 注意响应格式的差异

需要注意的是，不同模型返回的对象形状有所不同。

像 `mistral-small-3.1-24b-instruct` 这样的模型，会直接将字符串本身作为结果对象的 `.response` 属性返回。而像 `gemma-4-26b-a4b-it` 这样的模型，则返回与 OpenAI 兼容的 `.choices[0].message.content` 结构。具体属于哪一种因模型而异，请在所用模型页面的输出模式（schema）中确认。建议先从返回 `.response` 的简单模型开始尝试，这样最不容易犹豫。

```js
const answer = await env.AI.run("@cf/mistralai/mistral-small-3.1-24b-instruct", {
  messages: [
    { role: "system", content: "请用日语在 40 个字符以内简明地回答。" },
    { role: "user", content: "请用一句话概括 Cloudflare Workers 的优点" },
  ],
  max_tokens: 80,
});

console.log(answer.response); // 生成的文本字符串
```

- 如果希望将响应逐次流式传输至浏览器，请指定 `{ stream: true }` 将其作为 Server-Sent Events（SSE）处理。
- 按 Neuron（不区分模型、衡量 GPU 计算量的单位）计费。Workers Free 和 Paid 均可每天免费使用 10,000 Neuron，超出部分在 Workers Paid 上按每 1,000 Neuron $0.011 收费。
- 在生产环境中，为了防止因无限制调用导致计费事故，标准做法是在调用之前接入 **AI Gateway**（把 `{ gateway: { id: "网关名称" } }` 作为 `env.AI.run()` 的第三个参数传入），并配置缓存和速率限制。
