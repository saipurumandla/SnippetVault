import clipboard from 'clipboardy';
import { ApiError } from '@snippetvault/api-client';
import { CliError, type Io } from '../io.js';
import { vaultFrom } from '../vault.js';

export interface GetOptions {
  copy?: boolean;
  json?: boolean;
}

export async function get(io: Io, idArg: string, opts: GetOptions, copy = (s: string) => clipboard.write(s)) {
  const id = Number(idArg.replace(/^#/, ''));
  if (!Number.isInteger(id) || id < 1) throw new CliError(`Not a snippet id: ${idArg}`);

  const vault = vaultFrom(io);
  const snippet = await vault.snippets.get(id).catch(err => {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      throw new CliError(`No snippet #${id}. Sensitive snippets only open in the web app`);
    }
    throw err;
  });

  if (opts.copy) {
    try {
      await copy(snippet.code);
    } catch {
      throw new CliError('Cant copy, no clipboard here (on linux it needs wl-copy or xsel)');
    }
    await vault.snippets.copied(id).catch(() => {});
    io.stderr.write(`Copied #${id} ${snippet.title}\n`);
    return;
  }
  if (opts.json) {
    io.stdout.write(JSON.stringify(snippet, null, 2) + '\n');
    return;
  }
  io.stdout.write(snippet.code.endsWith('\n') ? snippet.code : snippet.code + '\n');
}
