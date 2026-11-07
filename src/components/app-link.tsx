import { forwardRef } from "react";
import type { LinkComponentProps } from "@cloudflare/kumo";

// Lets Kumo's Link components render a plain anchor: every page is rendered by the server.
export const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  ({ href, ...rest }, ref) => <a ref={ref} href={href} {...rest} />,
);
AppLink.displayName = "AppLink";
