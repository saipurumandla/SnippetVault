import { createClient } from '@snippetvault/api-client';
import { DEFAULT_URL, loadConfig } from './config.js';
import { CliError, type Io } from './io.js';

export function vaultFrom(io: Io) {
  const { url, token } = loadConfig(io.env);
  if (!token) throw new CliError('Not logged in. Run: sv login');
  return createClient({ baseUrl: `${(url ?? DEFAULT_URL).replace(/\/+$/, '')}/api`, token, fetch: io.fetch });
}
