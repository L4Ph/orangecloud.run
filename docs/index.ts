import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';

export type Doc = {
  slug: string;
  title: MessageDescriptor;
  summary: MessageDescriptor;
};

export const docs: Doc[] = [
  {
    slug: 'hono',
    title: msg`Hono のルーターとミドルウェア`,
    summary: msg`ルーターの仕組み、ミドルウェアの合成、型と RPC`,
  },
  {
    slug: 'runtimes',
    title: msg`ランタイムの深掘り`,
    summary: msg`isolate が何を省略しているか、コンテナとの分岐`,
  },
  {
    slug: 'state',
    title: msg`状態の置き場所を選ぶ`,
    summary: msg`一貫性・サイズ・課金から KV / D1 / R2 / Durable Objects を選ぶ`,
  },
];
