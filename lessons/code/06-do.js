export default {
  async fetch(request, env) {
    // 同じ名前（lesson-counter）の実体に何度でも届く
    const before = await env.COUNTER.read();

    const now = await env.COUNTER.increment();
    const again = await env.COUNTER.increment();

    console.log('before =', before);
    console.log('increment ->', now, again);

    return Response.json({
      before,
      after: again,
      note: 'この値は Worker の再起動でも消えない。DO のストレージに住んでいる',
    });
  },
};
