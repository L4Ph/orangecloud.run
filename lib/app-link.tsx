import { forwardRef, type MouseEvent } from 'react';
import { useRouter } from '@void/react';
import type { LinkComponentProps } from '@cloudflare/kumo';

// Lets Kumo's Link components navigate through Void's router.
export const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  ({ href, onClick, ...rest }, ref) => {
    const router = useRouter();

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!href || !href.startsWith('/') || href.startsWith('/#')) return;

      event.preventDefault();
      void router.visit(new URL(href, window.location.origin));
    };

    return <a ref={ref} href={href} onClick={handleClick} {...rest} />;
  },
);
AppLink.displayName = 'AppLink';
