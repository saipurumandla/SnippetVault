import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

const { SV_URL, SV_TOKEN, SV_JWT, SV_IDS } = process.env as Record<string, string>;
const [retryId, logsId] = SV_IDS!.split(',').map(Number);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitFor<T>(get: () => T | undefined, ms = 5000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = get();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await sleep(100);
  }
}

async function openDoc(content: string, language: string) {
  const doc = await vscode.workspace.openTextDocument({ content, language });
  return vscode.window.showTextDocument(doc);
}

async function pickFirst(command: string, query?: string) {
  const done = vscode.commands.executeCommand(command, query);
  // quick pick has no api for tests, wait for server answer
  await sleep(1500);
  await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
  await done;
}

describe('SnippetVault extension', () => {
  before(async () => {
    await vscode.workspace.getConfiguration('snippetvault').update('serverUrl', SV_URL, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('snippetvault.setToken', SV_TOKEN);
  });

  afterEach(() => vscode.commands.executeCommand('workbench.action.closeAllEditors'));

  it('registers its commands', async () => {
    const all = await vscode.commands.getCommands(true);
    for (const c of ['setToken', 'signOut', 'search', 'saveSelection', 'insert']) {
      assert.ok(all.includes(`snippetvault.${c}`), c);
    }
  });

  it('search opens the snippet with editor language', async () => {
    await pickFirst('snippetvault.search', 'pipefail');
    const ed = await waitFor(() => vscode.window.activeTextEditor);
    assert.equal(ed.document.languageId, 'shellscript');
    assert.match(ed.document.getText(), /mtime \+7/);
  });

  it('saves only the selection, with editor language', async () => {
    const ed = await openDoc('const a = 1;\nfunction twice(n) {\n  return n * 2;\n}\nconst b = 2;\n', 'javascriptreact');
    ed.selection = new vscode.Selection(1, 0, 3, 1);
    await vscode.commands.executeCommand('snippetvault.saveSelection', { title: 'Twice', tags: ['Math', 'math'] });

    const res = await fetch(`${SV_URL}/api/snippets?q=twice`, { headers: { Authorization: `Bearer ${SV_JWT}` } });
    const [saved] = await res.json() as { title: string; language: string; code: string; tags: string[] }[];
    assert.deepEqual([saved!.title, saved!.language, saved!.tags], ['Twice', 'javascript', ['math']]);
    assert.equal(saved!.code, 'function twice(n) {\n  return n * 2;\n}');
  });

  it('inserts at the cursor with the same indent', async () => {
    const ed = await openDoc('function main() {\n  \n}\n', 'typescript');
    ed.selection = new vscode.Selection(1, 2, 1, 2);
    await pickFirst('snippetvault.insert');
    const lines = ed.document.getText().split('\n');
    assert.equal(lines[1], '  function twice(n) {');
    assert.equal(lines[2], '    return n * 2;');
  });

  it('shows a hover for vault links', async () => {
    const ed = await openDoc(`// copied from snippetvault://${retryId}\n// and snippetvault://snippet/${logsId}\n// gone snippetvault://999999\n`, 'typescript');
    const hoverText = async (line: number, ch: number) => {
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', ed.document.uri, new vscode.Position(line, ch));
      const md = hovers.flatMap(h => h.contents).map(c => (typeof c === 'string' ? c : c.value)).join('\n');
      return md.replace(/&nbsp;/g, ' ').replace(/\\(.)/g, '$1');
    };
    assert.match(await hoverText(0, 20), /Retry fetch with backoff[\s\S]*```typescript/);
    assert.match(await hoverText(1, 20), /Clean old logs[\s\S]*```shellscript/);
    assert.match(await hoverText(2, 15), /no snippet #999999/);
    assert.equal(await hoverText(0, 3), '');
  });

  it('stops working after sign out', async () => {
    await vscode.commands.executeCommand('snippetvault.signOut');
    const ed = await openDoc(`// snippetvault://${retryId + 100}\n`, 'typescript');
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', ed.document.uri, new vscode.Position(0, 10));
    assert.equal(hovers.length, 0);
  });
});
