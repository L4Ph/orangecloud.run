import { languageDetector } from 'hono/language';
import { locales, sourceLocale } from '../lib/locales';

// Query (?lang=en) wins so shared links keep their language; the cookie keeps the
// choice for the next visit; Accept-Language is the first-visit default.
export default languageDetector({
  supportedLanguages: [...locales],
  fallbackLanguage: sourceLocale,
  order: ['querystring', 'cookie', 'header'],
  lookupQueryString: 'lang',
  lookupCookie: 'lang',
  caches: ['cookie'],
  cookieOptions: { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'Lax' },
});
