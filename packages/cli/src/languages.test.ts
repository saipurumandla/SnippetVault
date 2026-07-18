import { describe, it, expect } from 'vitest';
import { languageFromFile, languageFromShebang } from './languages.js';
import { formatRows } from './commands/find.js';
import type { Snippet } from '@snippetvault/api-client';

describe('language detection', () => {
  it('uses the file extension', () => {
    expect(languageFromFile('src/retry.TS')).toBe('typescript');
    expect(languageFromFile('/tmp/deploy.sh')).toBe('bash');
    expect(languageFromFile('C:\\work\\query.sql')).toBe('sql');
    expect(languageFromFile('notes')).toBeUndefined();
    expect(languageFromFile('.bashrc')).toBeUndefined();
  });

  it('falls back to the shebang', () => {
    expect(languageFromShebang('#!/usr/bin/env python3\nprint(1)')).toBe('python');
    expect(languageFromShebang('#!/bin/sh\necho')).toBe('bash');
    expect(languageFromShebang('echo no shebang')).toBeUndefined();
  });
});

describe('find output', () => {
  it('lines up ids and cuts long titles', () => {
    const row = (id: number, title: string, tags: string[] = []) => ({ id, title, language: 'go', tags }) as unknown as Snippet;
    const out = formatRows([row(7, 'Short'), row(123, 'x'.repeat(80), ['http'])]).split('\n');
    expect(out[0]).toMatch(/^ {2}#7 {2}Short +go$/);
    expect(out[1]).toMatch(/^#123 {2}x/);
    expect(out[1]).toContain('…');
    expect(out[1]).toMatch(/go +http$/);
  });
});
