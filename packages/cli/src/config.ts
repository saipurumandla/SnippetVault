import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  url: string;
  token: string;
}

export const DEFAULT_URL = 'http://localhost:3001';

export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'snippetvault');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Partial<Config> {
  let saved: Partial<Config> = {};
  try {
    saved = JSON.parse(readFileSync(join(configDir(env), 'config.json'), 'utf8'));
  } catch {
    // no file yet, fine
  }
  return {
    url: env.SNIPPETVAULT_URL || saved.url,
    token: env.SNIPPETVAULT_TOKEN || saved.token,
  };
}

export function saveConfig(config: Config, env: NodeJS.ProcessEnv = process.env): string {
  const dir = configDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, 'config.json');
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  // mode is ignored when file already exist
  chmodSync(file, 0o600);
  return file;
}
