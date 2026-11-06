export default {
  async fetch(request, env) {
    // exec() は改行で文を分割するので、DDL は prepare().run() で 1 行にして渡す
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS playground_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
    ).run();

    // bind で値を渡す（文字列連結はしない）
    await env.DB.prepare('INSERT INTO playground_notes (body) VALUES (?)')
      .bind('メモ ' + new Date().toISOString())
      .run();

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM playground_notes').first();
    console.log('rows =', count.n);

    // 索引を張ると WHERE が速くなり、読む行数＝課金も減る
    await env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_notes_created ON playground_notes (created_at)',
    ).run();

    const { results } = await env.DB.prepare(
      'SELECT id, body, created_at FROM playground_notes ORDER BY id DESC LIMIT 5',
    ).all();

    return Response.json({ total: count.n, latest: results });
  },
};
