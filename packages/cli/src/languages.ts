const BY_EXT: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
  py: 'python',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  sql: 'sql',
  json: 'json',
  yml: 'yaml', yaml: 'yaml',
  html: 'html', htm: 'html',
  css: 'css',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cs: 'csharp',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', h: 'cpp',
  md: 'markdown',
  txt: 'plaintext',
};

export const LANGUAGES = [...new Set(Object.values(BY_EXT))];

export function languageFromFile(file: string): string | undefined {
  const name = file.toLowerCase().split(/[\\/]/).pop() ?? '';
  if (name === 'dockerfile' || name === 'makefile') return 'plaintext';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? BY_EXT[name.slice(dot + 1)] : undefined;
}

export function languageFromShebang(code: string): string | undefined {
  const first = code.split('\n', 1)[0] ?? '';
  if (!first.startsWith('#!')) return undefined;
  if (/\b(bash|sh|zsh)\b/.test(first)) return 'bash';
  if (/\bpython/.test(first)) return 'python';
  if (/\bnode\b/.test(first)) return 'javascript';
  return undefined;
}
