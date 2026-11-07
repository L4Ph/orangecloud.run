// isolate が再利用される間だけ残る（リクエスト間の永続性は保証されない）
// Survives only while the isolate is reused (not guaranteed across requests)
let hits = 0;

export default {
  async fetch(request, env, ctx) {
    hits += 1;

    console.log('hits =', hits);
    console.log('method =', request.method);

    // waitUntil: レスポンスを返したあとも非同期処理を継続する
    // waitUntil: Continue background tasks after returning the response
    ctx.waitUntil(Promise.resolve().then(() => console.log('post-response task complete')));

    return Response.json(
      {
        hits,
        url: request.url,
        userAgent: request.headers.get('user-agent'),
      },
      { headers: { 'x-demo': 'workers-runtime' } },
    );
  },
};
