import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';
import { startTestServer } from '@snippetvault/server/testing';

const root = fileURLToPath(new URL('..', import.meta.url));
// oldest version we support in engines
const VSCODE_VERSION = process.env.VSCODE_VERSION ?? '1.100.0';

const srv = await startTestServer();
const seed = [
  { title: 'Retry fetch with backoff', language: 'typescript', code: 'export async function retry(fn, tries = 3) {\n  for (let i = 0; ; i++) {\n    try {\n      return await fn();\n    } catch (e) {\n      if (i >= tries - 1) throw e;\n    }\n  }\n}\n' },
  { title: 'Clean old logs', language: 'bash', code: '#!/usr/bin/env bash\nset -euo pipefail\nfind . -name "*.log" -mtime +7 -delete\n' },
];
const ids: number[] = [];
for (const s of seed) ids.push((await srv.api<{ id: number }>('/snippets', s, srv.token)).id);

let code = 1;
try {
  code = await runTests({
    version: VSCODE_VERSION,
    extensionDevelopmentPath: root,
    extensionTestsPath: `${root}out/suite/index.cjs`,
    launchArgs: ['--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes'],
    extensionTestsEnv: { SV_URL: srv.url, SV_TOKEN: srv.token, SV_JWT: srv.jwt, SV_IDS: ids.join(',') },
  });
} catch (err) {
  console.error('vs code tests failed', err);
} finally {
  await srv.close();
}
process.exit(code);
