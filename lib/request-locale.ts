import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { resolveLocale, type Locale } from "./locales";

// Query first so shared links keep their language, then the cookie the switcher
// writes, then the browser's header.
export function requestLocale(c: Context): Locale {
  const query = c.req.query("lang");
  if (query) return resolveLocale(query);
  return resolveLocale(getCookie(c, "lang") ?? c.req.header("accept-language"));
}
