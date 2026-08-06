import * as vscode from 'vscode';
import { getVault, setToken, signOut } from './auth.js';
import { pickSnippet } from './search.js';
import { toEditorLanguage } from './languages.js';

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
  );
}

export function deactivate() {}
