import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TokenOwner } from '../tokens.js';
import { searchSnippets } from './search.js';
import { getReadableSnippet, listReadableTags } from './read.js';

const hitShape = z.object({
  id: z.number(),
  title: z.string(),
  language: z.string(),
  tags: z.array(z.string()),
  score: z.number(),
  excerpt: z.string(),
});

function denied(scope: string) {
  return { isError: true, content: [{ type: 'text' as const, text: `This token does not have the "${scope}" scope.` }] };
}

export function createVaultServer(owner: TokenOwner): McpServer {
  const server = new McpServer({ name: 'snippetvault', version: '3.1.0' });
  const can = (scope: string) => owner.scopes.includes(scope as TokenOwner['scopes'][number]);

  server.registerTool('search_snippets', {
    title: 'Search snippets',
    description: 'Search the user\'s code snippet vault by meaning and keywords. Returns the best matching snippets with a short excerpt. Use get_snippet for the full code.',
    inputSchema: {
      query: z.string().min(1).max(500).describe('What you are looking for, in plain words or code terms'),
      language: z.string().optional().describe('Only this language, e.g. "python" or "typescript"'),
      limit: z.number().int().min(1).max(20).optional().describe('How many results, default 8'),
    },
    outputSchema: { results: z.array(hitShape) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ query, language, limit }) => {
    if (!can('read')) return denied('read');
    const results = await searchSnippets(owner.userId, query, { language, limit });
    const text = results.length
      ? results.map(r => `#${r.id} ${r.title} (${r.language})${r.tags.length ? ` [${r.tags.join(', ')}]` : ''}`).join('\n')
      : 'No matching snippets.';
    return { content: [{ type: 'text', text }], structuredContent: { results } };
  });

  server.registerTool('get_snippet', {
    title: 'Get snippet',
    description: 'Get one snippet with its full code, by id. Ids come from search_snippets.',
    inputSchema: { id: z.number().int().positive().describe('Snippet id, e.g. 12') },
    outputSchema: {
      id: z.number(),
      title: z.string(),
      description: z.string().nullable(),
      language: z.string(),
      tags: z.array(z.string()),
      visibility: z.string(),
      updated_at: z.string(),
      code: z.string(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id }) => {
    if (!can('read')) return denied('read');
    const snippet = getReadableSnippet(owner.userId, id);
    // same answer for sensitive and missing, no probing
    if (!snippet) return { isError: true, content: [{ type: 'text', text: `No snippet #${id}.` }] };
    const header = `#${snippet.id} ${snippet.title} (${snippet.language})${snippet.description ? `\n${snippet.description}` : ''}`;
    return {
      content: [{ type: 'text', text: `${header}\n\n\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`` }],
      structuredContent: { ...snippet },
    };
  });

  server.registerTool('list_tags', {
    title: 'List tags',
    description: 'List the tags used in the vault, with how many snippets have each tag.',
    outputSchema: { tags: z.array(z.object({ tag: z.string(), count: z.number() })) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => {
    if (!can('read')) return denied('read');
    const tags = listReadableTags(owner.userId);
    const text = tags.length ? tags.map(t => `${t.tag} (${t.count})`).join(', ') : 'No tags yet.';
    return { content: [{ type: 'text', text }], structuredContent: { tags } };
  });

  return server;
}
