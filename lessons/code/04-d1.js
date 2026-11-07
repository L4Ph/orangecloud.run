export default {
  async fetch(request, env) {
    // DDL は prepare().run() で実行（exec() は改行で文を分割するため注意）
    // Execute DDL with prepare().run() (exec() splits statements on newlines)
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS playground_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
    ).run();

    // プリペアドステートメントで値を安全にバインド（SQLインジェクション防止）
    // Bind parameters safely using prepared statements (prevents SQL injection)
    await env.DB.prepare('INSERT INTO playground_notes (body) VALUES (?)')
      .bind('note ' + new Date().toISOString())
      .run();

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM playground_notes').first();
    console.log('rows =', count.n);

    // インデックスを作成してスキャン行数（＝課金対象）を抑える
    // Create an index to speed up WHERE clauses and reduce scanned rows
    await env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_notes_created ON playground_notes (created_at)',
    ).run();

    const { results } = await env.DB.prepare(
      'SELECT id, body, created_at FROM playground_notes ORDER BY id DESC LIMIT 5',
    ).all();

    return Response.json({ total: count.n, latest: results });
  },
};
