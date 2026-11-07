export default {
  async fetch(request, env) {
    // 同じ名前（lesson-counter）の実体にルーティングされる
    // Routes to the exact same Durable Object instance identified by name
    const before = await env.COUNTER.read();

    const now = await env.COUNTER.increment();
    const again = await env.COUNTER.increment();

    console.log("before =", before);
    console.log("increment ->", now, again);

    return Response.json({
      before,
      after: again,
      // この値は Worker の再起動でも消えない（DO ストレージに永続化。24 時間呼ばれないと削除される）
      // Persists across Worker restarts (saved in Durable Object storage; deleted after 24 hours without a call)
      note: "Durable Object storage",
    });
  },
};
