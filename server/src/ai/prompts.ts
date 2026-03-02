import type { SnippetRow } from '../types.js';
import type { RetrievedChunk } from '../rag/retriever.js';

type PromptSnippet = Pick<SnippetRow, 'title' | 'language' | 'code'>;

export function explainPrompt(snippet: PromptSnippet, ragContext: RetrievedChunk[]): string {
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

export function summarizePrompt(snippet: PromptSnippet, ragContext: RetrievedChunk[]): string {
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

export function refactorPrompt(snippet: PromptSnippet): string {
  return `Suggest one specific refactoring improvement for this code. Show only the changed section, not the full file. Briefly explain why.

${snippet.title} (${snippet.language})
\`\`\`${snippet.language}
${snippet.code}
\`\`\`

Refactoring suggestion:`;
}

export function convertPrompt(snippet: PromptSnippet, targetLanguage: string): string {
  return `You are a code conversion assistant. Your job is to convert code between languages — but ONLY when the conversion is genuinely feasible.

## BEFORE converting, check these rules:

**Refuse the conversion if:**
- The code uses browser-only APIs (navigator.clipboard, window, document, localStorage, sessionStorage, fetch in a browser context, DOM manipulation) and the target is a non-browser language like Rust, Go, Python, Java, C++ — these APIs simply do not exist there.
- The code is CSS or HTML and the target is a programming language.
- The code is a shell script and the target language has no equivalent system access model.
- The conversion would be so different it serves no meaningful purpose.

**If refusing:** Do NOT produce any code block. Instead write a clear, helpful explanation:
1. Exactly WHY the conversion is not feasible (be specific — name the API or feature that doesn't translate).
2. What the closest equivalent would be in ${targetLanguage} and what it would require (e.g., a specific crate, library, or completely different approach).
3. A concrete suggestion for what the user could do instead.

**If the conversion IS feasible:** Provide the complete converted code first in a \`\`\`${targetLanguage} code block (do not truncate), then a brief note on differences or idioms to be aware of.

---

${snippet.title} (${snippet.language}):
\`\`\`${snippet.language}
${snippet.code}
\`\`\`

Convert to ${targetLanguage}:`;
}

export function suggestPrompt(code: string, language?: string): string {
  return `You are a code documentation assistant. Analyze this ${language || 'code'} snippet and respond with ONLY a valid JSON object — no markdown, no explanation, just the JSON.

\`\`\`${language || ''}
${code}
\`\`\`

Respond with exactly this structure:
{
  "title": "short descriptive title, 4-7 words, imperative style e.g. 'Format date to DD/MM/YYYY'",
  "description": "one or two sentences describing what the code does and any notable details"
}`;
}

