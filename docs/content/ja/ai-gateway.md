# AI Gateway

モデル API の**手前に立つ関所**です。推論はしません。OpenAI・Anthropic・Gemini・Workers AI などへの呼び出しを 1 つの URL に集め、ログ・キャッシュ・制限・フォールバックを付けます。

## 何がうれしいか

- **ログ**：誰が何を何トークン使ったか、全部残る
- **キャッシュ**：同じプロンプトはキャッシュから返す（コスト削減）
- **レート制限**：1 ユーザーあたり 1 分 N 回、など
- **フォールバック**：安いモデルが落ちたら別のモデルへ
- **コスト制御**：予算アラートと上限

## 使い方（2通り）

1. **プロバイダの URL を差し替える**：`https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway}/openai/chat/completions`
2. **Workers の `ai` バインディングから呼ぶ**（Gateway を経由させたいときは 1 の URL を使う）

```js
const res = await fetch(
  `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/anthropic/v1/messages`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY },
    body: JSON.stringify({ model: 'claude-3-5-haiku', max_tokens: 200, messages: [...] }),
  },
);
```

## 民主的に安く運用するコツ

- 既定は最安モデル。上位モデルは「このボタンを押した人だけ」
- キャッシュを有効にして、同じ質問を二度課金しない
- レート制限は IP ではなく**ユーザー単位**で（今回は認証なしなので IP 単位）
- 入力の長さをサーバー側で切る（長文をそのまま投げない）
- 失敗時はフォールバック先を決めておく

Gateway の設定と API キーが必要なので、ここではコード例だけを示します。
