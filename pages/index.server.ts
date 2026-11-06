import { defineHandler, defineHead, type InferProps } from 'void';
import { resolveLocale } from '../lib/locales';

export const loader = defineHandler((c) => ({
  locale: resolveLocale(
    (c.get('language') as string | undefined) ?? c.req.header('accept-language'),
  ),
}));

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_c, props) => ({
  htmlAttrs: { lang: props.locale },
}));
