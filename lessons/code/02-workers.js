let hits = 0; // isolate が再利用される間だけ残る。保証は無い。

export default {
  async fetch(request, env, ctx) {
    hits += 1;

    console.log('hits =', hits, '（同じ isolate に当たれば増える）');
    console.log('method =', request.method);

    // waitUntil: レスポンスを返したあとに続く処理
    ctx.waitUntil(Promise.resolve().then(() => console.log('レスポンス後に走る')));

    return Response.json(
      {
        hits,
        note: 'この数字はリクエストをまたぐ保証がない',
        url: request.url,
        userAgent: request.headers.get('user-agent'),
      },
      { headers: { 'x-demo': 'workers-runtime' } },
    );
  },
};
