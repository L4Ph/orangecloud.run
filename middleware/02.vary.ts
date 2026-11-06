import { defineMiddleware } from 'void';

// The page is rendered in the visitor's language, so caches must key on the
// inputs that decide it.
export default defineMiddleware(async (c, next) => {
  await next();
  c.header('Vary', 'Accept-Language, Cookie');
});
