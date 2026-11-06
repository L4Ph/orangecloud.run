import { defineEnv, string } from 'void/env';

export default defineEnv({
  // Create/reveal it on the Turnstile widget in the dashboard, then
  // `void secret put TURNSTILE_SECRET` for production.
  TURNSTILE_SECRET: string(),
});
