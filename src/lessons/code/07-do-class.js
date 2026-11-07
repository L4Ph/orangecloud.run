import { DurableObject } from "cloudflare:workers";

// App という名前のクラスが、このサイトの Durable Object の子（facet）として動く
// A class named App runs as a child (facet) of this site's Durable Object
export class App extends DurableObject {
  // インメモリ状態：最速だが、退避やコード更新で消える
  // In-memory state: fastest, but lost on eviction or a code change
  memory = 0;

  fetch() {
    this.memory += 1;

    // SQLite：ディスクに残り、コードを書き換えても消えない
    // SQLite: durable, survives even a code change
    const sql = this.ctx.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS hits (n INTEGER)");
    sql.exec("INSERT INTO hits VALUES (1)");
    const sqlite = sql.exec("SELECT COUNT(*) AS c FROM hits").one().c;

    // 数字を書き換えて再実行すると、memory は 1 に戻り、sqlite は増え続ける
    // Edit anything and re-run: memory resets to 1, sqlite keeps counting
    return Response.json({ memory: this.memory, sqlite });
  }
}
