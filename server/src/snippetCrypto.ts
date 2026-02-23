import { decryptAesGcm, unwrapKey } from './crypto.js';
import { getOrCreateProjectKey, getPersonalKey } from './keystore.js';
import type { SnippetRow } from './types.js';

export function decryptSnippet(snippet: SnippetRow, userId: number): SnippetRow {
  if (snippet.encryption_mode !== 'standard' || !snippet.wrapped_key) return snippet;
  try {
    const projectKey = snippet.project_id ? getOrCreateProjectKey(snippet.project_id) : getPersonalKey(userId);
    const snippetKey = unwrapKey(snippet.wrapped_key, projectKey);
    return { ...snippet, code: decryptAesGcm(snippet.code, snippetKey) };
  } catch (err) {
    console.error('decryptSnippet failed for snippet', snippet.id, (err as Error).message);
    return snippet;
  }
}
