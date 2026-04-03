import { describe, it, expect } from 'vitest';
import { ftsTerms, ftsAnyOf, ftsPrefix } from '../src/rag/fts.ts';

describe('fts helpers', () => {
  it('keeps only word characters', () => {
    expect(ftsTerms('how do we retry http calls?')).toEqual(['how', 'do', 'we', 'retry', 'http', 'calls']);
    expect(ftsTerms('"; DROP TABLE x --')).toEqual(['DROP', 'TABLE', 'x']);
    expect(ftsTerms('café über_snake 42')).toEqual(['café', 'über_snake', '42']);
  });

  it('builds quoted queries', () => {
    expect(ftsAnyOf('retry http?')).toBe('"retry" OR "http"');
    expect(ftsPrefix('parse cs')).toBe('"parse"* "cs"*');
    expect(ftsAnyOf('?!')).toBeNull();
    expect(ftsPrefix('   ')).toBeNull();
  });
});
