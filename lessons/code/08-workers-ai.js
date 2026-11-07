export default {
  async fetch(request, env) {
    const prompt =
      new URL(request.url).searchParams.get('prompt') ?? 'Cloudflare Workers を一言で説明して';

    const answer = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
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
