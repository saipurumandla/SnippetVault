import * as vscode from 'vscode';
import { createClient, type VaultClient } from '@snippetvault/api-client';

const SECRET_KEY = 'snippetvault.token';

export function serverUrl(): string {
  return vscode.workspace.getConfiguration('snippetvault').get<string>('serverUrl', 'http://localhost:3001').replace(/\/+$/, '');
}

export async function getVault(secrets: vscode.SecretStorage, quiet = false): Promise<VaultClient | undefined> {
  const token = await secrets.get(SECRET_KEY);
  if (!token) {
    if (quiet) return undefined;
    const pick = await vscode.window.showWarningMessage('SnippetVault needs an access token first.', 'Set token');
    if (pick) await vscode.commands.executeCommand('snippetvault.setToken');
    return undefined;
  }
  return createClient({ baseUrl: `${serverUrl()}/api`, token });
}

export async function setToken(secrets: vscode.SecretStorage, given?: string) {
  const token = given ?? await vscode.window.showInputBox({
    title: 'SnippetVault access token',
    prompt: 'Make one in the web app under Access tokens. read to search, write to save',
    password: true,
    ignoreFocusOut: true,
    validateInput: v => (v.trim().startsWith('sv_') ? undefined : 'Access tokens start with sv_'),
  });
  if (!token) return;

  const vault = createClient({ baseUrl: `${serverUrl()}/api`, token: token.trim() });
  try {
    const me = await vault.request<{ email: string; scopes: string[] }>('GET', '/tokens/current');
    await secrets.store(SECRET_KEY, token.trim());
    vscode.window.showInformationMessage(`SnippetVault: connected as ${me.email} (${me.scopes.join(', ')})`);
  } catch (err) {
    showError(err);
  }
}

export async function signOut(secrets: vscode.SecretStorage) {
  await secrets.delete(SECRET_KEY);
  vscode.window.showInformationMessage('SnippetVault: token removed');
}

export function showError(err: unknown) {
  const status = (err as { status?: number }).status;
  if (status === 401) {
    vscode.window.showErrorMessage('SnippetVault: token not valid or revoked.', 'Set token')
      .then(pick => pick && vscode.commands.executeCommand('snippetvault.setToken'));
    return;
  }
  if (err instanceof TypeError) {
    vscode.window.showErrorMessage(`SnippetVault: cant reach ${serverUrl()}. Is the server running?`);
    return;
  }
  vscode.window.showErrorMessage(`SnippetVault: ${(err as Error).message}`);
}
