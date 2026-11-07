# Durable Objects と Actor モデル

Durable Objects（DO）は「状態を持つ小さなサーバー」と説明されますが、正体は **Actor モデル**の実装です。Actor モデルを知ると、なぜ DO がクラスで書かれ、なぜメソッド呼び出しが直列化されるのかが腹に落ちます。

## Actor モデルの約束

Actor モデル（Erlang のプロセス、Akka の Actor）は次の 4 つでできています。

1. **同一性**: 各 actor は名前で指せる。同じ名前は常に同じ実体
2. **私有状態**: 状態は actor の中だけ。外から直接触れない
3. **メッセージ**: 外とのやり取りはメッセージ送信のみ。受信箱に順番に積まれる
4. **一回に一つ**: actor はメッセージを 1 つずつ処理する。内部に競合状態が生まれない

共有メモリもロックも不要で、状態がどこにあるか（location transparency）を意識せずに済むのが利点です。

## DO との対応

| Actor モデル     | Durable Objects                                      |
| ---------------- | ---------------------------------------------------- |
| actor の名前     | `env.ROOM.get(env.ROOM.idFromName('room-1'))` の名前 |
| 私有状態         | `ctx.storage`（SQLite）と `this` のフィールド        |
| メッセージ       | `fetch()`（HTTP）と RPC メソッド                     |
| 受信箱と直列化   | プラットフォームが保証。メソッドは 1 つずつ実行      |
| 俳優の死と再生成 | isolate の退避と hibernation。状態は storage に残る  |
| 所在地           | 最初にアクセスした colo に置かれる                   |

## なぜクラスなのか

**クラスは「振る舞いの単位」であり、同時に「デプロイと移行の単位」**だからです。

- 同じ振る舞いの実体を名前ごとに何千と作る。だから「型（クラス）」と「インスタンス（名前）」を分ける必要がある
- クラス名はバインディングと migration（`new_sqlite_classes`）の単位。コードを別クラスに移すと別リソースになる
- メソッドがそのままメッセージハンドラになる。RPC は型付きで、`fetch` は HTTP 用
- `this.ctx` に storage / alarm / id がぶら下がる。能力（capability）がインスタンスに紐づく
- コンストラクタは**アクティベーションのたび**に走る。フィールドは揮発、永続は storage。この区別を言語機能として強制できる

関数と KV で同じことをやろうとすると、直列化・排他・再起動後の復元・配置を自分で作ることになります。

## コードの形

```ts
export class Room extends DurableObject {
  async join(user: string) {
    const members = (await this.ctx.storage.get<string[]>('members')) ?? [];
    if (!members.includes(user)) members.push(user);
    await this.ctx.storage.put('members', members);
    return members;
  }

  async alarm() {
    // 30 分後に一度だけ起こされる
    await this.ctx.storage.deleteAll();
  }
}
```

`join` は RPC メソッド。同時に 2 人来ても、DO の中では 1 つずつ処理されるので `members` が壊れません。

## 限界と注意

- **並列性はない**。1 つの DO のスループットは 1 コア相当。ホットなキーは分割する（ユーザーごと、部屋ごと）
- **await の間だけ**他のメッセージが割り込む。`await` をまたいで状態を読むときは順序に注意
- 大量の行を読む処理には向かない。集計は D1、ファイルは R2
- 場所は最初のアクセスで決まる。世界中から同じ DO に集めると遅い
- 使っていない間は課金されない（hibernation）。WebSocket は Hibernation API を使う

## actor で解くべき問題

チャットルーム、在庫、ゲームのルーム、レート制限、ワークフローの調整役、AI エージェントの記憶。**「同じ名前の状態を、同時に 1 人だけが触る」**が要件なら DO です。逆に、読み取り中心の一覧や集計なら D1、バイト列なら R2 が適しています。
