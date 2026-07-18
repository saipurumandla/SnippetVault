import { createInterface } from 'node:readline/promises';
import { createClient } from '@snippetvault/api-client';
import { DEFAULT_URL, loadConfig, saveConfig } from '../config.js';
import { CliError, readAll, type Io } from '../io.js';

interface TokenInfo {
  name: string;
  scopes: string[];
  email: string;
}

async function askToken(io: Io): Promise<string> {
  if (!io.stdin.isTTY) return (await readAll(io.stdin)).trim();
  io.stderr.write('Make a token in the web app under Access tokens (read and write scopes).\n');
  const rl = createInterface({ input: io.stdin, output: io.stderr as NodeJS.WritableStream });
  try {
    return (await rl.question('Token: ')).trim();
  } finally {
    rl.close();
  }
}

export async function login(io: Io, opts: { url?: string; token?: string }) {
  const url = (opts.url ?? loadConfig(io.env).url ?? DEFAULT_URL).replace(/\/+$/, '');
  const token = opts.token ?? await askToken(io);
  if (!token.startsWith('sv_')) throw new CliError('That is not an access token, they start with sv_');

  const vault = createClient({ baseUrl: `${url}/api`, token, fetch: io.fetch });
  let me: TokenInfo;
  try {
    me = await vault.request<TokenInfo>('GET', '/tokens/current');
  } catch (err) {
    if (err instanceof TypeError) throw new CliError(`Cant reach ${url}, is the server running?`);
    throw err;
  }
  const file = saveConfig({ url, token }, io.env);
  io.stdout.write(`Logged in to ${url} as ${me.email} (token "${me.name}", ${me.scopes.join(', ')})\n`);
  if (!me.scopes.includes('write')) io.stderr.write('This token has no write scope, sv save will not work.\n');
  io.stderr.write(`Saved to ${file}\n`);
}
