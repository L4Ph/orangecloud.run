export default {
  async fetch(request, env) {
    // 書き込み（結果整合性: 別のエッジへ伝播するまで遅延が生じることがある）
    // Write (eventual consistency: changes take time to propagate globally)
    await env.KV.put('user:1', 'Alice');
    await env.KV.put('user:2', 'Bob');
    await env.KV.put('user:3', { name: 'Carol', plan: 'pro' });

    console.log('list:', await env.KV.list('user:'));

    // 読み出し（オブジェクトは JSON 形式のまま復元される）
    // Read (objects are stored and parsed as JSON)
    const user1 = await env.KV.get('user:1');
    const user3 = await env.KV.get('user:3');
    console.log('user:1 =', user1);
    console.log('user:3 =', user3);

    // 削除 / Delete
    await env.KV.delete('user:2');

    return Response.json({
      user1,
      user3,
      afterDelete: await env.KV.list('user:'),
    });
  },
};
