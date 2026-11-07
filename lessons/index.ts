import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import enginesCode from './code/01-engines.js?raw';
import workersCode from './code/02-workers.js?raw';
import kvCode from './code/03-kv.js?raw';
import d1Code from './code/04-d1.js?raw';
import r2Code from './code/05-r2.js?raw';
import doCode from './code/06-do.js?raw';
import aiCode from './code/08-workers-ai.js?raw';
import honoCode from './code/hono.js?raw';

export type Lesson = {
  id: string;
  title: MessageDescriptor;
  summary: MessageDescriptor;
  code: string;
  language?: 'javascript' | 'shell';
  runnable: boolean;
  hint?: MessageDescriptor;
};

export const lessons: Lesson[] = [
  {
    id: 'engines',
    title: msg`JavaScript エンジンとランタイム`,
    summary: msg`V8 / SpiderMonkey / JavaScriptCore / QuickJS / Hermes、そして Node・Bun・Deno・Workers`,
    code: enginesCode,
    runnable: true,
  },
  {
    id: 'workers',
    title: msg`Workers の実行モデル`,
    summary: msg`isolate、状態を持たない、制限、課金`,
    code: workersCode,
    runnable: true,
  },
  {
    id: 'hono',
    title: msg`Hono`,
    summary: msg`ルーティング、ミドルウェア、バリデーション。小さく速い Web フレームワーク`,
    code: honoCode,
    runnable: false,
    hint: msg`この単元は資料のみ（Hono は事前にバンドルが必要です）`,
  },
  {
    id: 'kv',
    title: msg`KV`,
    summary: msg`速い読み取りと結果整合。キャッシュや設定の置き場`,
    code: kvCode,
    runnable: true,
  },
  {
    id: 'd1',
    title: msg`D1`,
    summary: msg`SQLite。SQL、索引、課金される「行数」`,
    code: d1Code,
    runnable: true,
  },
  {
    id: 'r2',
    title: msg`R2`,
    summary: msg`S3 互換のオブジェクトストレージ。転送無料`,
    code: r2Code,
    runnable: true,
  },
  {
    id: 'durable-objects',
    title: msg`Durable Objects`,
    summary: msg`名前ごとに 1 つの実体。状態と直列化`,
    code: doCode,
    runnable: true,
  },
  {
    id: 'queues',
    title: msg`Queues / Workflows`,
    summary: msg`非同期処理と、再開できる長時間ジョブ`,
    code: `// Queues: 送る側は send()、受ける側は別 Worker のコンシューマ
await env.QUEUE_EMAILS.send({ to: 'a@example.com', template: 'welcome' });

// Workflows: ステップごとに保存され、落ちても続きから再開される
export class Onboarding extends WorkflowEntrypoint {
  async run(event, step) {
    const user = await step.do('create user', async () => createUser(event.payload));
    await step.sleep('wait a day', '1 day');
    await step.do('send tips', async () => sendTips(user));
  }
}
`,
    runnable: false,
    hint: msg`この単元は資料のみ（共有サンドボックスではキューを流せません）`,
  },
  {
    id: 'workers-ai',
    title: msg`Workers AI`,
    summary: msg`GPU を持たずに推論。まずは安いモデルから`,
    code: aiCode,
    runnable: true,
    hint: msg`費用はこのサイト側で持ちます。ローカル開発だけは Cloudflare ログインが必要です`,
  },
  {
    id: 'ai-gateway',
    title: msg`AI Gateway`,
    summary: msg`ログ・キャッシュ・制限・フォールバックをモデルの手前に`,
    code: `const res = await fetch(
  \`https://gateway.ai.cloudflare.com/v1/\${accountId}/\${gateway}/anthropic/v1/messages\`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY },
    body: JSON.stringify({ model: 'claude-3-5-haiku', max_tokens: 200, messages: [] }),
  },
);
`,
    runnable: false,
    hint: msg`この単元は資料のみ（Gateway の設定と API キーが必要）`,
  },
  {
    id: 'containers',
    title: msg`Containers`,
    summary: msg`isolate で足りないときの最後の手段`,
    code: `import { getSandbox } from '@cloudflare/sandbox';

const sandbox = await getSandbox(env.SANDBOX, 'user-123');
const result = await sandbox.run('node --version');
console.log(result.stdout);
`,
    runnable: false,
    hint: msg`この単元は資料のみ（イメージのビルドと有料プランが必要）`,
  },
  {
    id: 'deploy',
    title: msg`デプロイまで`,
    summary: msg`ログイン、秘密値、デプロイ、公開後の確認`,
    code: `# ログイン
npx wrangler login

# 秘密値を登録
npx wrangler secret put MY_API_KEY

# デプロイ
npx wrangler deploy
`,
    language: 'shell',
    runnable: false,
    hint: msg`この単元は手元のターミナルで実行してください`,
  },
];
