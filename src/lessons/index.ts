import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import enginesCode from "./code/01-engines.js?raw";
import workersCode from "./code/02-workers.js?raw";
import kvCode from "./code/03-kv.js?raw";
import d1Code from "./code/04-d1.js?raw";
import r2Code from "./code/05-r2.js?raw";
import doCode from "./code/06-do.js?raw";
import doClassCode from "./code/07-do-class.js?raw";
import aiCode from "./code/08-workers-ai.js?raw";
import pythonCode from "./code/python.py?raw";
import containersCode from "./code/containers.py?raw";
import containersNodeCode from "./code/containers-node.mjs?raw";
import containersShellCode from "./code/containers-shell.sh?raw";

export type LessonSection = "basics" | "languages" | "storage" | "compute" | "ship";

export const lessonSections: { id: LessonSection; title: MessageDescriptor }[] = [
  { id: "basics", title: msg`基礎` },
  { id: "languages", title: msg`言語とフレームワーク` },
  { id: "storage", title: msg`ストレージ` },
  { id: "compute", title: msg`実行環境` },
  { id: "ship", title: msg`公開と運用` },
];

export type Lesson = {
  id: string;
  section: LessonSection;
  title: MessageDescriptor;
  summary: MessageDescriptor;
  code: string;
  language?: "javascript" | "shell" | "python";
  /** Where the code runs: a Dynamic Worker (default) or a container. */
  runner?: "container" | "durable-object";
  runnable: boolean;
  hint?: MessageDescriptor;
};

export const lessons: Lesson[] = [
  {
    id: "engines",
    section: "basics",
    title: msg`JavaScript エンジンとランタイム`,
    summary: msg`V8 / SpiderMonkey / JavaScriptCore / QuickJS / Hermes、そして Node・Bun・Deno・Workers`,
    code: enginesCode,
    runnable: true,
  },
  {
    id: "workers",
    section: "basics",
    title: msg`Workers の実行モデル`,
    summary: msg`isolate、状態を持たない、制限、課金`,
    code: workersCode,
    runnable: true,
  },
  {
    id: "python",
    section: "languages",
    title: msg`Python`,
    summary: msg`構文もランタイムも違う言語が、同じ Worker として動く`,
    code: pythonCode,
    language: "python",
    runnable: true,
  },
  {
    id: "kv",
    section: "storage",
    title: msg`KV`,
    summary: msg`速い読み取りと結果整合。キャッシュや設定の置き場`,
    code: kvCode,
    runnable: true,
  },
  {
    id: "d1",
    section: "storage",
    title: msg`D1`,
    summary: msg`SQLite。SQL、索引、課金される「行数」`,
    code: d1Code,
    runnable: true,
  },
  {
    id: "r2",
    section: "storage",
    title: msg`R2`,
    summary: msg`S3 互換のオブジェクトストレージ。転送無料`,
    code: r2Code,
    runnable: true,
  },
  {
    id: "durable-objects",
    section: "storage",
    title: msg`Durable Objects`,
    summary: msg`名前ごとに 1 つの実体。状態と直列化`,
    code: doCode,
    runnable: true,
  },
  {
    id: "durable-object-class",
    section: "storage",
    title: msg`Durable Object を自分で書く`,
    summary: msg`インメモリ状態と SQLite の違いを、コードを書き換えて確かめる`,
    code: doClassCode,
    runner: "durable-object",
    runnable: true,
  },
  {
    id: "containers",
    section: "compute",
    title: msg`Containers で実行する`,
    summary: msg`Docker イメージの中で Python を動かす。isolate では無理な処理の逃げ道`,
    code: containersCode,
    language: "python",
    runner: "container",
    runnable: true,
  },
  {
    id: "containers-node",
    section: "compute",
    title: msg`Containers で Node.js を動かす`,
    summary: msg`isolate では動かない child_process や、本物のファイルシステム・OS の情報が、コンテナでは普通に使える`,
    code: containersNodeCode,
    language: "javascript",
    runner: "container",
    runnable: true,
  },
  {
    id: "containers-shell",
    section: "compute",
    title: msg`Containers でシェルを動かす`,
    summary: msg`任意の Linux コマンドをパイプでつなぐ。FFmpeg などは、イメージに入れれば同じ形で使える`,
    code: containersShellCode,
    language: "shell",
    runner: "container",
    runnable: true,
  },
  {
    id: "workers-ai",
    section: "compute",
    title: msg`Workers AI`,
    summary: msg`GPU を持たずに推論。まずは安いモデルから`,
    code: aiCode,
    runnable: true,
    hint: msg`費用はこのサイト側で持ちます。ローカル開発だけは Cloudflare ログインが必要です`,
  },
];
