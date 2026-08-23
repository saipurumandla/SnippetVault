import * as vscode from 'vscode';
import type { Snippet, VaultClient } from '@snippetvault/api-client';
import { toEditorLanguage } from './languages.js';

const LINK = /snippetvault:\/\/(?:snippet\/)?(\d+)/;
const MAX_LINES = 25;
const cache = new Map<number, { at: number; snippet: Snippet | null }>();

export function fence(code: string, language: string): string {
  const lines = code.replace(/\n$/, '').split('\n');
  const shown = lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES), `… ${lines.length - MAX_LINES} more lines`] : lines;
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map(t => t.length));
  const ticks = '`'.repeat(longest + 1);
  return `${ticks}${toEditorLanguage(language)}\n${shown.join('\n')}\n${ticks}`;
}

export class SnippetHover implements vscode.HoverProvider {
  constructor(private readonly vault: () => Promise<VaultClient | undefined>) {}

  async provideHover(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Hover | undefined> {
    const range = doc.getWordRangeAtPosition(pos, new RegExp(LINK.source));
    if (!range) return undefined;
    const id = Number(LINK.exec(doc.getText(range))?.[1]);

    let entry = cache.get(id);
    if (!entry || Date.now() - entry.at > 60_000) {
      const vault = await this.vault();
      if (!vault) return undefined;
      const snippet = await vault.snippets.get(id).catch(() => null);
      entry = { at: Date.now(), snippet };
      cache.set(id, entry);
    }

    const md = new vscode.MarkdownString();
    if (!entry.snippet) {
      md.appendText(`SnippetVault: no snippet #${id}, or you cant read it`);
      return new vscode.Hover(md, range);
    }
    const s = entry.snippet;
    md.appendMarkdown(`**${escape(s.title)}** · ${s.language}${s.tags.length ? ' · ' + s.tags.map(t => `#${escape(t)}`).join(' ') : ''}\n\n`);
    if (s.description) md.appendText(s.description + '\n\n');
    md.appendMarkdown(fence(s.code, s.language));
    return new vscode.Hover(md, range);
  }
}

function escape(text: string) {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&');
}
