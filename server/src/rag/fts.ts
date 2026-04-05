// fts5 MATCH break on ? - " : so quote word chars only
export function ftsTerms(text: string): string[] {
  return text.match(/[\p{L}\p{N}_]+/gu) ?? [];
}

export function ftsAnyOf(text: string): string | null {
  const terms = ftsTerms(text);
  return terms.length ? terms.map(t => `"${t}"`).join(' OR ') : null;
}

export function ftsPrefix(text: string): string | null {
  const terms = ftsTerms(text);
  return terms.length ? terms.map(t => `"${t}"*`).join(' ') : null;
}
