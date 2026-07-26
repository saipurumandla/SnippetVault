import type { Snippet } from '@snippetvault/api-client';
import type { Io } from '../io.js';
import { vaultFrom } from '../vault.js';

export interface FindOptions {
  lang?: string;
  project?: string;
  limit?: string;
  tag?: string[];
  json?: boolean;
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
  const tags = (opts.tag ?? []).map(t => t.toLowerCase());
  const matching = tags.length ? rows.filter(r => tags.every(t => r.tags.includes(t))) : rows;
  const limited = matching.slice(0, Number(opts.limit ?? 20));
  if (opts.json) {
    io.stdout.write(JSON.stringify(limited, null, 2) + '\n');
    return;
  }
  if (!limited.length) {
    const filtered = q || tags.length || opts.lang || opts.project;
    io.stderr.write(filtered ? 'No snippets match\n' : 'No snippets yet\n');
    return;
  }
  io.stdout.write(formatRows(limited));
  if (matching.length > limited.length) io.stderr.write(`${matching.length - limited.length} more, use -n to see them\n`);
}
