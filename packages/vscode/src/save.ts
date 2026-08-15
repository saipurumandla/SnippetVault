import * as vscode from 'vscode';
import { basename } from 'node:path';
import type { VaultClient } from '@snippetvault/api-client';
import { showError } from './auth.js';
import { toVaultLanguage } from './languages.js';

export interface SaveArgs {
  title?: string;
  tags?: string[];
}

export async function saveSelection(vault: VaultClient, editor: vscode.TextEditor, args: SaveArgs = {}) {
  const { document, selection } = editor;
  const code = selection.isEmpty ? document.getText() : document.getText(selection);
  if (!code.trim()) {
    vscode.window.showWarningMessage('SnippetVault: nothing selected to save');
    return;
  }

  const title = args.title ?? await vscode.window.showInputBox({
    title: 'Save to SnippetVault',
    prompt: selection.isEmpty ? 'Title for the whole file' : 'Title for the selected code',
    value: document.isUntitled ? '' : basename(document.fileName),
    ignoreFocusOut: true,
    validateInput: v => (v.trim() ? undefined : 'Title is required'),
  });
  if (!title) return;

  const tagText = args.title ? (args.tags ?? []).join(',') : await vscode.window.showInputBox({
    title: 'Save to SnippetVault',
    prompt: 'Tags, comma separated (optional)',
    placeHolder: 'http, retry',
    ignoreFocusOut: true,
  });
  if (tagText === undefined) return;

  const language = toVaultLanguage(document.languageId);
  try {
    const snippet = await vault.snippets.create({ title: title.trim(), code, language });
    const tags = [...new Set(tagText.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))];
    for (const tag of tags) await vault.tags.add(snippet.id, tag);
    vscode.window.showInformationMessage(`SnippetVault: saved #${snippet.id} ${snippet.title} (${language})`);
  } catch (err) {
    showError(err);
  }
}
