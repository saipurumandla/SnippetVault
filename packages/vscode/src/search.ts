import * as vscode from 'vscode';
import type { Snippet, VaultClient } from '@snippetvault/api-client';
import { showError } from './auth.js';

export interface SnippetItem extends vscode.QuickPickItem {
  snippet: Snippet;
}

export function toItem(s: Snippet): SnippetItem {
  const firstLine = s.code.split('\n').find(l => l.trim()) ?? '';
  return {
    label: s.title,
    description: [s.language, ...s.tags.map(t => `#${t}`)].join('  '),
    detail: firstLine.trim().slice(0, 120),
    // server did the search, dont hide code matches
    alwaysShow: true,
    snippet: s,
  };
}

export function pickSnippet(vault: VaultClient, title = 'Search vault', query = ''): Promise<Snippet | undefined> {
  return new Promise(resolve => {
    const qp = vscode.window.createQuickPick<SnippetItem>();
    qp.title = title;
    qp.placeholder = 'Type to search title, description and code';
    let timer: NodeJS.Timeout | undefined;
    let seq = 0;

    const load = async (q: string) => {
      const mine = ++seq;
      qp.busy = true;
      try {
        const rows = await vault.snippets.list({ q: q.trim() || undefined });
        // old answer can come after a newer one
        if (mine === seq) qp.items = rows.slice(0, 50).map(toItem);
      } catch (err) {
        qp.hide();
        showError(err);
      } finally {
        if (mine === seq) qp.busy = false;
      }
    };

    qp.onDidChangeValue(v => {
      clearTimeout(timer);
      timer = setTimeout(() => load(v), 250);
    });
    qp.onDidAccept(() => {
      resolve(qp.selectedItems[0]?.snippet);
      qp.hide();
    });
    qp.onDidHide(() => {
      clearTimeout(timer);
      resolve(undefined);
      qp.dispose();
    });
    qp.value = query;
    qp.show();
    load(query);
  });
}
