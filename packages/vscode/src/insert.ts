import * as vscode from 'vscode';
import type { VaultClient } from '@snippetvault/api-client';
import { pickSnippet } from './search.js';

export function indentLike(code: string, indent: string): string {
  const lines = code.replace(/\n$/, '').split('\n');
  return lines.map((line, i) => (i === 0 || !line ? line : indent + line)).join('\n');
}

export async function insertSnippet(vault: VaultClient, editor: vscode.TextEditor) {
  const snippet = await pickSnippet(vault, 'Insert snippet');
  if (!snippet) return;

  await editor.edit(edit => {
    for (const sel of editor.selections) {
      const indent = editor.document.lineAt(sel.start.line).text.match(/^\s*/)?.[0] ?? '';
      edit.replace(sel, indentLike(snippet.code, indent));
    }
  });
  vault.snippets.copied(snippet.id).catch(() => {});
}
