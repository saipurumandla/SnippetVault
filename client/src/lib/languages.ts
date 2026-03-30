export const LANGUAGES: { id: string; label: string }[] = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'bash', label: 'Bash' },
  { id: 'sql', label: 'SQL' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
  { id: 'cpp', label: 'C++' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'plaintext', label: 'Plain text' },
];

const LABELS = new Map(LANGUAGES.map(l => [l.id, l.label]));

export function languageLabel(id: string): string {
  return LABELS.get(id) ?? id;
}
