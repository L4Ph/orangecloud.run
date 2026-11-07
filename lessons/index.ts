import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import enginesCode from './code/01-engines.js?raw';
import workersCode from './code/02-workers.js?raw';
import kvCode from './code/03-kv.js?raw';
import d1Code from './code/04-d1.js?raw';
import r2Code from './code/05-r2.js?raw';
import doCode from './code/06-do.js?raw';
import aiCode from './code/08-workers-ai.js?raw';

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
    id: 'workers-ai',
    title: msg`Workers AI`,
    summary: msg`GPU を持たずに推論。まずは安いモデルから`,
    code: aiCode,
    runnable: true,
    hint: msg`費用はこのサイト側で持ちます。ローカル開発だけは Cloudflare ログインが必要です`,
  },
];
