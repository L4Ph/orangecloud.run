# Workers AI

Cloudflare の GPU 上でモデルを動かす仕組み。**推論エンジンも GPU の管理も自分で持たずに**、モデル名と入力だけ渡します。サーバーレスなので、使った分だけの課金です。

## まずは安いモデルから

| モデル | 用途 | 目安 |
| --- | --- | --- |
| `@cf/meta/llama-3.1-8b-instruct` | 汎用の会話・要約 | 安い。まずこれ |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 難しい推論 | 高い |
| `@cf/baai/bge-small-en-v1.5` | 埋め込み（検索・RAG） | 非常に安い |
| `@cf/openai/whisper` | 音声→文字 | 秒課金 |

価格は「入力トークン」「出力トークン」の従量制。安いモデルなら 1 回数円未満です。まずは 8B で動かし、足りないときだけ上げる。

## 呼び方

```js
const answer = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
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

Workers AI はローカルで動きません。Cloudflare アカウントへのログインが必要です。実行して認証エラーが出たら、ターミナルで `void cloudflare login` してから再実行してください。

費用を気にするなら、次の単元の **AI Gateway** を前段に置くと、キャッシュ・レート制限・利用額の把握がまとめて手に入ります。
