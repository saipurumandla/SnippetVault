import type { Snippet } from '@snippetvault/api-client';
import type { Io } from '../io.js';
import { vaultFrom } from '../vault.js';

export interface FindOptions {
  lang?: string;
  project?: string;
  limit?: string;
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function formatRows(rows: Snippet[]): string {
  const idWidth = Math.max(...rows.map(r => String(r.id).length)) + 1;
  return rows.map(r => {
    const tags = r.tags.length ? `  ${r.tags.join(', ')}` : '';
    return `${`#${r.id}`.padStart(idWidth)}  ${cut(r.title, 50).padEnd(50)}  ${r.language.padEnd(10)}${tags}`.trimEnd();
  }).join('\n') + '\n';
}

export async function find(io: Io, words: string[], opts: FindOptions) {
  const vault = vaultFrom(io);
  const q = words.join(' ').trim();
  const rows = await vault.snippets.list({
    q: q || undefined,
    language: opts.lang,
    project_id: opts.project ? Number(opts.project) : undefined,
  });
  const limited = rows.slice(0, Number(opts.limit ?? 20));
  if (!limited.length) {
    io.stderr.write(q ? `No snippets match "${q}"\n` : 'No snippets yet\n');
    return;
  }
  io.stdout.write(formatRows(limited));
  if (rows.length > limited.length) io.stderr.write(`${rows.length - limited.length} more, use -n to see them\n`);
}
