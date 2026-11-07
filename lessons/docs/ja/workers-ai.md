# Workers AI

Cloudflare の GPU 上でモデルを動かす仕組み。**推論エンジンも GPU の管理も自分で持たずに**、モデル名と入力だけ渡します。サーバーレスなので、使った分だけの課金です。

## まずは安いモデルから

| モデル                                         | 用途                  | 目安               |
| ---------------------------------------------- | --------------------- | ------------------ |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 汎用の会話・要約      | 安い。まずこれ     |
| `@cf/openai/gpt-oss-20b`                       | 推論が必要なとき      | 推論トークンを使う |
| `@cf/baai/bge-small-en-v1.5`                   | 埋め込み（検索・RAG） | 非常に安い         |
| `@cf/openai/whisper`                           | 音声→文字             | 秒課金             |

価格は「入力トークン」「出力トークン」の従量制。安いモデルなら 1 回数円未満です。まずは小さいモデルで動かし、足りないときだけ上げる。

モデルは頻繁に入れ替わります。使う前に [Workers AI のモデルカタログ](https://developers.cloudflare.com/workers-ai/models/) で ID と廃止予定を確認してください。ここに載せた ID も将来は消えます。

料金は出力トークンで決まることが多いので、出力単価で比べます。`mistral-small-3.1-24b` は出力 $0.555/M トークンで、llama-3.3-70b の $2.253/M より約4倍安く、`response` に文字列を返します。

モデルによって返し方が違います。`@cf/mistralai/mistral-small-3.1-24b-instruct` は `response` に文字列を返しますが、gpt-oss-20b のような推論モデルは `choices[0].message.content` に返し、考えるためのトークンを多く使います。最初は `response` を返すモデルが扱いやすいです。

## 呼び方

```js
const answer = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
  messages: [
    { role: 'system', content: '短く答える。' },
    { role: 'user', content: 'Cloudflare Workers を一言で' },
  ],
});
answer.response; // 文字列
```

- `stream: true` でストリーミング（SSE）
- 埋め込みは `env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [...] })` → Vectorize に入れて検索
- 画像生成・音声認識・翻訳も同じ `run()` で呼べる

## この環境での注意

この教材では**費用をサイト側が持ちます**。API キーは不要です（Workers AI はバインディングそのものが認証を兼ねています）。

ただし Workers AI にはローカルのシミュレータが無いため、`npm run dev` で試すときだけ Cloudflare へのログインが必要です。認証エラーが出たら `npx wrangler login` してから再実行してください。デプロイ後は誰でもそのまま動きます。

公開するときは、実行回数の制限と安いモデルの固定を忘れずに。次の単元の **AI Gateway** を前段に置くと、キャッシュ・レート制限・利用額の把握がまとめて手に入ります。
