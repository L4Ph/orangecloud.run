import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

import type { LessonSection } from "../lessons";

export type Doc = {
  slug: string;
  section: LessonSection;
  title: MessageDescriptor;
  summary: MessageDescriptor;
};

export const docs: Doc[] = [
  {
    slug: "hono",
    section: "languages",
    title: msg`Hono`,
    summary: msg`ルーティング、ミドルウェア、バリデーション。小さく速い Web フレームワーク`,
  },
  {
    slug: "hono-router",
    section: "languages",
    title: msg`Hono のルーターとミドルウェア`,
    summary: msg`ルーターの仕組み、ミドルウェアの合成、型と RPC`,
  },
  {
    slug: "rust",
    section: "languages",
    title: msg`Rust（workers-rs）`,
    summary: msg`Rust を Wasm にコンパイルして動かす。ビルドが要る理由`,
  },
  {
    slug: "runtimes",
    section: "basics",
    title: msg`ランタイムの深掘り`,
    summary: msg`isolate が何を省略しているか、コンテナとの分岐`,
  },
  {
    slug: "actors",
    section: "storage",
    title: msg`Durable Objects と Actor モデル`,
    summary: msg`なぜ class なのか、どこまでが actor なのか`,
  },
  {
    slug: "state",
    section: "storage",
    title: msg`状態の置き場所を選ぶ`,
    summary: msg`一貫性・サイズ・課金から KV / D1 / R2 / Durable Objects を選ぶ`,
  },
  {
    slug: "queues",
    section: "compute",
    title: msg`Queues / Workflows`,
    summary: msg`非同期処理と、再開できる長時間ジョブ`,
  },
  {
    slug: "ai-gateway",
    section: "compute",
    title: msg`AI Gateway`,
    summary: msg`ログ・キャッシュ・制限・フォールバックをモデルの手前に`,
  },
  {
    slug: "containers",
    section: "compute",
    title: msg`Containers`,
    summary: msg`isolate で足りないときの最後の手段`,
  },
  {
    slug: "deploy",
    section: "ship",
    title: msg`デプロイまで`,
    summary: msg`ログイン、秘密値、デプロイ、公開後の確認`,
  },
  {
    slug: "playground",
    section: "ship",
    title: msg`このサイトの仕組み`,
    summary: msg`Dynamic Workers、バインディングの中継、実行の制限`,
  },
];
