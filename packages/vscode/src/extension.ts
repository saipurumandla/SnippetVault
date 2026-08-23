import * as vscode from 'vscode';
import { getVault, setToken, signOut } from './auth.js';
import { pickSnippet } from './search.js';
import { toEditorLanguage } from './languages.js';
import { saveSelection, type SaveArgs } from './save.js';
import { insertSnippet } from './insert.js';
import { SnippetHover } from './hover.js';

export function activate(context: vscode.ExtensionContext) {
  const { secrets } = context;

  context.subscriptions.push(
    vscode.commands.registerCommand('snippetvault.setToken', (token?: unknown) => setToken(secrets, typeof token === 'string' ? token : undefined)),
    vscode.commands.registerCommand('snippetvault.signOut', () => signOut(secrets)),
    vscode.commands.registerCommand('snippetvault.search', async (query?: unknown) => {
      const vault = await getVault(secrets);
      if (!vault) return;
      const snippet = await pickSnippet(vault, 'Search vault', typeof query === 'string' ? query : '');
      if (!snippet) return;
      const doc = await vscode.workspace.openTextDocument({ content: snippet.code, language: toEditorLanguage(snippet.language) });
      await vscode.window.showTextDocument(doc, { preview: true });
    }),
    vscode.commands.registerTextEditorCommand('snippetvault.saveSelection', async (editor, _edit, args?: SaveArgs) => {
      const vault = await getVault(secrets);
      if (vault) await saveSelection(vault, editor, args);
    }),
    vscode.commands.registerTextEditorCommand('snippetvault.insert', async editor => {
      const vault = await getVault(secrets);
      if (vault) await insertSnippet(vault, editor);
    }),
    vscode.languages.registerHoverProvider({ scheme: '*' }, new SnippetHover(() => getVault(secrets, true))),
  );
}

export function deactivate() {}
