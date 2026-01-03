const { decryptAesGcm, unwrapKey } = require('./crypto');
const { getOrCreateProjectKey, getPersonalKey } = require('./keystore');

function decryptSnippet(snippet, userId) {
  if (snippet.encryption_mode !== 'standard' || !snippet.wrapped_key) {
    return snippet;
  }
  try {
    const projectKey = snippet.project_id
      ? getOrCreateProjectKey(snippet.project_id)
      : getPersonalKey(userId);
    const snippetKey = unwrapKey(snippet.wrapped_key, projectKey);
    const plainCode = decryptAesGcm(snippet.code, snippetKey);
    return { ...snippet, code: plainCode };
  } catch (err) {
    console.error('decryptSnippet failed for snippet', snippet.id, err.message);
    return snippet;
  }
}

module.exports = { decryptSnippet };
