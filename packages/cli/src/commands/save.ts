import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { Visibility } from '@snippetvault/api-client';
import { languageFromFile, languageFromShebang } from '../languages.js';
import { CliError, readAll, type Io } from '../io.js';
import { vaultFrom } from '../vault.js';

export interface SaveOptions {
  title?: string;
  lang?: string;
  desc?: string;
  tag?: string[];
  project?: string;
  visibility?: Visibility;
}

export async function save(io: Io, file: string | undefined, opts: SaveOptions) {
  let code: string;
  if (file && file !== '-') {
    try {
      code = readFileSync(file, 'utf8');
    } catch {
      throw new CliError(`Cant read ${file}`);
    }
  } else if (io.stdin.isTTY) {
    throw new CliError('Give a file, or pipe the code in: cat x.sh | sv save -t "title"');
  } else {
    code = await readAll(io.stdin);
  }
  if (!code.trim()) throw new CliError('Nothing to save, the code is empty');

  const title = opts.title ?? (file && file !== '-' ? basename(file) : undefined);
  if (!title) throw new CliError('Need a title when reading from stdin: -t "title"');
  const language = opts.lang ?? (file ? languageFromFile(file) : undefined) ?? languageFromShebang(code) ?? 'plaintext';

  const vault = vaultFrom(io);
  const snippet = await vault.snippets.create({
    title,
    code,
    language,
    description: opts.desc,
    visibility: opts.visibility,
    project_id: opts.project ? Number(opts.project) : undefined,
  });
  for (const tag of opts.tag ?? []) await vault.tags.add(snippet.id, tag);
  io.stdout.write(`Saved #${snippet.id} ${snippet.title} (${language})\n`);
}
