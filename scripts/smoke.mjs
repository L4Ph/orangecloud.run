// Runs every lesson snippet against a running dev server (default: 5173).
import { readdir, readFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://localhost:5173';
// containers.py needs Docker and starts a container; run it from the chapter.
const needsDocker = new Set(['containers.py']);
const files = (await readdir(new URL('../lessons/code/', import.meta.url)))
  .filter((file) => (file.endsWith('.js') || file.endsWith('.py')) && !needsDocker.has(file))
  .sort();

let failed = 0;
for (const file of files) {
  const code = await readFile(new URL(`../lessons/code/${file}`, import.meta.url), 'utf8');
  const response = await fetch(`${base}/api/sandbox`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, ...(file.endsWith('.py') ? { lang: 'python' } : {}) }),
  });
  const data = await response.json();
  // Workers AI has no local simulator; without a login it is expected to fail.
  if (/cloudflare login|Workers AI is unavailable/i.test(data.error ?? '')) {
    console.log('skip', file, 'Workers AI is unavailable in this environment');
    continue;
  }
  const ok = response.ok && !data.error;
  console.log(ok ? 'ok  ' : 'FAIL', file, ok ? `${data.ms}ms` : (data.error ?? response.status));
  if (!ok) failed += 1;
}

console.log(failed ? `${failed} lesson(s) failed` : `all ${files.length} lessons ran`);
process.exit(failed ? 1 : 0);
