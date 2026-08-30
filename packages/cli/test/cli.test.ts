import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { startTestServer, type TestServer } from '@snippetvault/server/testing';
import { run } from '../src/program.js';

const clipboard = vi.hoisted(() => ({ text: '' }));
vi.mock('clipboardy', () => ({ default: { write: async (s: string) => { clipboard.text = s; } } }));

let srv: TestServer;
beforeAll(async () => { srv = await startTestServer(); });
afterAll(() => srv.close());

function sv(args: string[], { stdin, tty = false, home }: { stdin?: string; tty?: boolean; home?: string } = {}) {
  const out = { stdout: '', stderr: '' };
  const input = Object.assign(Readable.from(stdin === undefined ? [] : [stdin]), { isTTY: tty });
  const io = {
    stdin: input,
    stdout: { write: (s: string) => { out.stdout += s; } },
    stderr: { write: (s: string) => { out.stderr += s; } },
    env: { XDG_CONFIG_HOME: home ?? mkdtempSync(join(tmpdir(), 'sv-')) },
  };
  return run(args, io).then(code => ({ code, ...out }));
}

async function loggedIn(token = srv.token) {
  const home = mkdtempSync(join(tmpdir(), 'sv-'));
  const res = await sv(['login', '--url', srv.url], { stdin: token + '\n', home });
  expect(res.code).toBe(0);
  return home;
}

describe('sv cli against a real server', () => {
  it('logs in with a piped token and keeps it private', async () => {
    const home = mkdtempSync(join(tmpdir(), 'sv-'));
    const res = await sv(['login', '--url', srv.url + '/'], { stdin: srv.token, home });
    expect(res.stdout).toContain(`as ${srv.email}`);
    const file = join(home, 'snippetvault', 'config.json');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ url: srv.url, token: srv.token });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(join(home, 'snippetvault')).mode & 0o777).toBe(0o700);
  });

  it('saves a file and gets the same code back', async () => {
    const home = await loggedIn();
    const dir = mkdtempSync(join(tmpdir(), 'code-'));
    const code = "#!/usr/bin/env bash\nset -euo pipefail\necho \"deploy $1\"\n";
    writeFileSync(join(dir, 'deploy.sh'), code);

    const saved = await sv(['save', join(dir, 'deploy.sh'), '--tag', 'Ops', '--tag', 'deploy'], { home });
    expect(saved.stdout).toMatch(/^Saved #(\d+) deploy\.sh \(bash\)/);
    const id = saved.stdout.match(/#(\d+)/)![1]!;

    expect((await sv(['get', id], { home })).stdout).toBe(code);
    const found = await sv(['find', 'pipefail', '--tag', 'ops'], { home });
    expect(found.stdout).toContain(`#${id}`);
    expect(found.stdout).toContain('deploy, ops');
  });

  it('reads stdin, needs a title for it', async () => {
    const home = await loggedIn();
    const noTitle = await sv(['save'], { stdin: 'SELECT 1;', home });
    expect(noTitle.code).toBe(1);
    expect(noTitle.stderr).toContain('Need a title');

    const ok = await sv(['save', '-t', 'Ping db', '-l', 'sql'], { stdin: 'SELECT 1;', home });
    expect(ok.stdout).toMatch(/Saved #\d+ Ping db \(sql\)/);
  });

  it('prints json for scripts and copies without printing code', async () => {
    const home = await loggedIn();
    const saved = await sv(['save', '-t', 'Sleep helper', '-l', 'python'], { stdin: 'import time\ntime.sleep(1)\n', home });
    const id = saved.stdout.match(/#(\d+)/)![1]!;

    const json = JSON.parse((await sv(['get', id, '--json'], { home })).stdout);
    expect(json).toMatchObject({ id: Number(id), title: 'Sleep helper', language: 'python' });
    const list = JSON.parse((await sv(['find', '--json', '-l', 'python'], { home })).stdout);
    expect(list.map((s: { id: number }) => s.id)).toContain(Number(id));

    const copied = await sv(['get', id, '--copy'], { home });
    expect(copied.stdout).toBe('');
    expect(copied.stderr).toContain(`Copied #${id}`);
    expect(clipboard.text).toBe('import time\ntime.sleep(1)\n');
  });

  it('never shows sensitive snippets', async () => {
    const home = await loggedIn();
    const secret = await srv.api<{ id: number }>('/snippets', {
      title: 'Prod database url', code: 'c2VhbGVk', language: 'plaintext', encryption_mode: 'sensitive', wrapped_key: 'sealed',
    }, srv.jwt);
    expect((await sv(['find', 'prod'], { home })).stdout).not.toContain('Prod database');
    const got = await sv(['get', String(secret.id)], { home });
    expect(got.code).toBe(1);
    expect(got.stderr).toContain('Sensitive snippets only open in the web app');
  });

  it('explains missing scope, revoked token and no login', async () => {
    const readOnly = await loggedIn(srv.readToken);
    const denied = await sv(['save', '-t', 'x'], { stdin: 'x', home: readOnly });
    expect(denied.stderr).toContain('Token needs the write scope');

    const made = await srv.api<{ id: number; token: string }>('/tokens', { name: 'short lived', scopes: ['read'] }, srv.jwt);
    const home = await loggedIn(made.token);
    await srv.api(`/tokens/${made.id}`, undefined, srv.jwt, 'DELETE');
    expect((await sv(['find'], { home })).stderr).toContain('token not valid or revoked');

    const none = await sv(['find']);
    expect(none.code).toBe(1);
    expect(none.stderr).toBe('sv: Not logged in. Run: sv login\n');
  });

  it('has no colour codes when output is not a terminal', async () => {
    const res = await sv(['get', 'abc']);
    expect(res.stderr).toBe('sv: Not a snippet id: abc\n');
  });
});
