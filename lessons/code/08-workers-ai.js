export default {
  async fetch(request, env) {
    const prompt =
      new URL(request.url).searchParams.get('prompt') ?? 'Cloudflare Workers を一言で説明して';

    // サーバーレス GPU 上でモデルを実行 / Run models directly on serverless GPUs
    const answer = await env.AI.run('@cf/mistralai/mistral-small-3.1-24b-instruct', {
      messages: [
        { role: 'system', content: '日本語で、40文字以内で答える。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 80,
    });

    console.log('prompt:', prompt);
    console.log('answer:', answer.response);

    return Response.json({ prompt, answer: answer.response });
  },
};
