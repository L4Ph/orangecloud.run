export default {
  async fetch(request, env) {
    // 書き込み（結果整合：別の場所からは少し遅れて見えることがある）
    await env.KV.put('user:1', 'Alice');
    await env.KV.put('user:2', 'Bob');
    await env.KV.put('user:3', { name: 'Carol', plan: 'pro' });

    console.log('list:', await env.KV.list('user:'));

    const user1 = await env.KV.get('user:1');
    const user3 = await env.KV.get('user:3');
    console.log('user:1 =', user1);
    console.log('user:3 =', user3, '(オブジェクトは JSON のまま戻る)');

    await env.KV.delete('user:2');

    return Response.json({
      user1,
      user3,
      afterDelete: await env.KV.list('user:'),
    });
  },
};
