import { useEffect, useRef } from "react";

// Existing widget created in the dashboard; the secret lives in env.ts.
const SITE_KEY = "0x4AAAAAAF2ii6uQu0bmz1si";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const existing = (window as { turnstile?: TurnstileApi }).turnstile;
    if (existing) return resolve(existing);
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      const api = (window as { turnstile?: TurnstileApi }).turnstile;
      if (api) {
        resolve(api);
      } else {
        reject(new Error("Turnstile did not initialise"));
      }
    };
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });
  return loading;
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let disposed = false;
    let widgetId: string | null = null;

    loadTurnstile()
      .then((api) => {
        if (disposed || !host.current) return;
        widgetId = api.render(host.current, {
          sitekey: SITE_KEY,
          action: "run",
          // Stay invisible unless Turnstile actually needs the visitor.
          appearance: "interaction-only",
          size: "flexible",
          theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      disposed = true;
      const api = (window as { turnstile?: TurnstileApi }).turnstile;
      if (api && widgetId) api.remove(widgetId);
    };
  }, []);

  // Fixed so the challenge never reflows the page; empty unless Turnstile asks.
  return <div className="fixed right-4 bottom-4 z-30" ref={host} />;
}
