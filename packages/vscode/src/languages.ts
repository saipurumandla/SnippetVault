// vault and vs code mostly use same ids, not for shell
const TO_EDITOR: Record<string, string> = { bash: 'shellscript' };
const FROM_EDITOR: Record<string, string> = {
  shellscript: 'bash',
  javascriptreact: 'javascript',
  typescriptreact: 'typescript',
  jsonc: 'json',
  c: 'cpp',
};

export const VAULT_LANGUAGES = ['javascript', 'typescript', 'python', 'bash', 'sql', 'json', 'yaml', 'html', 'css', 'go', 'rust', 'java', 'csharp', 'cpp', 'markdown', 'plaintext'];

export function toEditorLanguage(vaultId: string): string {
  return TO_EDITOR[vaultId] ?? vaultId;
}

export function toVaultLanguage(editorId: string): string {
  const id = FROM_EDITOR[editorId] ?? editorId;
  return VAULT_LANGUAGES.includes(id) ? id : 'plaintext';
}
