import enginesDoc from './01-engines.md?raw';
import enginesCode from './code/01-engines.js?raw';
import workersDoc from './02-workers.md?raw';
import workersCode from './code/02-workers.js?raw';
import kvDoc from './03-kv.md?raw';
import kvCode from './code/03-kv.js?raw';
import d1Doc from './04-d1.md?raw';
import d1Code from './code/04-d1.js?raw';
import r2Doc from './05-r2.md?raw';
import r2Code from './code/05-r2.js?raw';
import doDoc from './06-durable-objects.md?raw';
import doCode from './code/06-do.js?raw';
import queuesDoc from './07-queues-workflows.md?raw';
import aiDoc from './08-workers-ai.md?raw';
import aiCode from './code/08-workers-ai.js?raw';
import gatewayDoc from './09-ai-gateway.md?raw';
import containersDoc from './10-containers.md?raw';
import deployDoc from './11-deploy.md?raw';

export type Lesson = {
  id: string;
  title: string;
  summary: string;
  doc: string;
  code: string;
  language?: 'javascript' | 'shell';
  runnable: boolean;
  hint?: string;
};

export const lessons: Lesson[] = [
  {
    id: 'engines',
    title: 'JavaScript エンジンとランタイム',
    summary: 'V8 / SpiderMonkey / JavaScriptCore / QuickJS / Hermes、そして Node・Bun・Deno・Workers',
    doc: enginesDoc,
    code: enginesCode,
    runnable: true,
  },
  {
    id: 'workers',
    title: 'Workers の実行モデル',
    summary: 'isolate、状態を持たない、制限、課金',
    doc: workersDoc,
    code: workersCode,
    runnable: true,
  },
  {
    id: 'kv',
    title: 'KV',
    summary: '速い読み取りと結果整合。キャッシュや設定の置き場',
    doc: kvDoc,
    code: kvCode,
    runnable: true,
  },
  {
    id: 'd1',
    title: 'D1',
    summary: 'SQLite。SQL、索引、課金される「行数」',
    doc: d1Doc,
    code: d1Code,
    runnable: true,
  },
  {
    id: 'r2',
    title: 'R2',
    summary: 'S3 互換のオブジェクトストレージ。転送無料',
    doc: r2Doc,
    code: r2Code,
    runnable: true,
  },
  {
    id: 'durable-objects',
    title: 'Durable Objects',
    summary: '名前ごとに 1 つの実体。状態と直列化',
    doc: doDoc,
    code: doCode,
    runnable: true,
  },
  {
    id: 'queues',
    title: 'Queues / Workflows',
    summary: '非同期処理と、再開できる長時間ジョブ',
    doc: queuesDoc,
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
    hint: 'この単元は資料のみ（共有サンドボックスではキューを流せません）',
  },
  {
    id: 'workers-ai',
    title: 'Workers AI',
    summary: 'GPU を持たずに推論。まずは安いモデルから',
    doc: aiDoc,
    code: aiCode,
    runnable: true,
    hint: '要 Cloudflare ログイン（Workers AI はローカルで動きません）',
  },
  {
    id: 'ai-gateway',
    title: 'AI Gateway',
    summary: 'ログ・キャッシュ・制限・フォールバックをモデルの手前に',
    doc: gatewayDoc,
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
    hint: 'この単元は資料のみ（Gateway の設定と API キーが必要）',
  },
  {
    id: 'containers',
    title: 'Containers',
    summary: 'isolate で足りないときの最後の手段',
    doc: containersDoc,
    code: `import { getSandbox } from 'void/sandbox';

const sandbox = await getSandbox('user-123');
const result = await sandbox.run(['node', '--version']);
console.log(new TextDecoder().decode(result.stdout));
`,
    runnable: false,
    hint: 'この単元は資料のみ（イメージのビルドと有料プランが必要）',
  },
  {
    id: 'deploy',
    title: 'デプロイまで',
    summary: 'ログイン、秘密値、デプロイ、公開後の確認',
    doc: deployDoc,
    code: `# Cloudflare にログイン
npx void cloudflare login

# 本番の秘密値を登録
npx void secret put MY_API_KEY

# デプロイ
npx void deploy --platform cloudflare
`,
    language: 'shell',
    runnable: false,
    hint: 'この単元は手元のターミナルで実行してください',
  },
];
