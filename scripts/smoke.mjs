// Runs every lesson snippet against a running dev server (default: 5173).
// Workers AI needs a Cloudflare login, so its snippet is skipped unless
// INCLUDE_AI=1.
import { readdir, readFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://localhost:5173';
const includeAi = process.env.INCLUDE_AI === '1';
const files = (await readdir(new URL('../lessons/code/', import.meta.url)))
  .filter((file) => file.endsWith('.js'))
  .filter((file) => includeAi || !file.startsWith('08-'))
  .sort();

let failed = 0;
for (const file of files) {
  const code = await readFile(new URL(`../lessons/code/${file}`, import.meta.url), 'utf8');
  const response = await fetch(`${base}/api/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await response.json();
  const ok = response.ok && !data.error;
  console.log(ok ? 'ok  ' : 'FAIL', file, ok ? `${data.ms}ms` : data.error ?? response.status);
  if (!ok) failed += 1;
}

console.log(failed ? `${failed} lesson(s) failed` : `all ${files.length} lessons ran`);
process.exit(failed ? 1 : 0);
