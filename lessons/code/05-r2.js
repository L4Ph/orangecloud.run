export default {
  async fetch(request, env) {
    await env.STORAGE.put('lesson/hello.txt', 'はじめての R2 オブジェクト');
    await env.STORAGE.put('lesson/notes/1.txt', 'メモ 1');

    const text = await env.STORAGE.get('lesson/hello.txt');
    console.log('読み出し:', text);

    const list = await env.STORAGE.list('lesson/');
    console.log('一覧:', list);

    await env.STORAGE.delete('lesson/notes/1.txt');
    console.log('削除後:', await env.STORAGE.list('lesson/'));

    return Response.json({ text, list, afterDelete: await env.STORAGE.list('lesson/') });
  },
};
