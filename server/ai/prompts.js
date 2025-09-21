function explainPrompt(snippet, ragContext) {
  const ctx = ragContext && ragContext.length > 0
    ? `\nRelated context from your vault:\n${ragContext.map(c => `[snippet:${c.snippet_id}] ${c.text}`).join('\n---\n')}`
    : '';

  return `You are a code assistant. Explain the following code snippet clearly and concisely. Do not invent details not present in the code.${ctx}

Snippet: ${snippet.title} (${snippet.language})
\`\`\`${snippet.language}
${snippet.code}
\`\`\`

Explanation:`;
}

function summarizePrompt(snippet, ragContext) {
  const ctx = ragContext && ragContext.length > 0
    ? `\nRelated context:\n${ragContext.map(c => `[snippet:${c.snippet_id}] ${c.text}`).join('\n---\n')}`
    : '';
  return `Summarize the purpose of this code snippet in 2-3 sentences. Only describe what the code does. Do not add information not present.${ctx}

${snippet.title} (${snippet.language})
\`\`\`${snippet.language}
${snippet.code}
\`\`\`

Summary:`;
}

function refactorPrompt(snippet) {
  return `Suggest one specific refactoring improvement for this code. Show only the changed section, not the full file. Briefly explain why.

${snippet.title} (${snippet.language})
\`\`\`${snippet.language}
${snippet.code}
\`\`\`

Refactoring suggestion:`;
}

module.exports = { explainPrompt, summarizePrompt, refactorPrompt };
