import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isTokenActive, type TokenOwner } from '../tokens.js';
import { searchSnippets } from './search.js';
import { getReadableSnippet, listReadableTags } from './read.js';
import { MAX_PENDING, createDraft, pendingCount } from '../drafts.js';
import { logEvent } from '../securityLog.js';
import { takeCall } from './rateLimit.js';

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

function revoked() {
  return { isError: true, content: [{ type: 'text' as const, text: 'This token was revoked. Ask the user for a new one.' }] };
}

function limited() {
  return { isError: true, content: [{ type: 'text' as const, text: 'Too many tool calls for this token. Wait a minute and try again.' }] };
}

export function createVaultServer(owner: TokenOwner): McpServer {
  const server = new McpServer({ name: 'snippetvault', version: '3.1.0' });
  const can = (scope: string) => owner.scopes.includes(scope as TokenOwner['scopes'][number]);
  const audit = (tool: string, ok: boolean, snippetId?: number | null, extra: Record<string, unknown> = {}) =>
    logEvent(owner.userId, 'mcp_tool', snippetId, { tool, token: owner.tokenName, ok, ...extra });
  const gate = (tool: string, scope: string) => {
    // stdio session live for days, check revoke each call
    if (!isTokenActive(owner.tokenId)) return revoked();
    if (!takeCall(owner.tokenId)) {
      audit(tool, false, null, { reason: 'rate_limited' });
      return limited();
    }
    if (!can(scope)) {
      audit(tool, false, null, { reason: 'scope' });
      return denied(scope);
    }
    return null;
  };

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
    const stop = gate('search_snippets', 'read');
    if (stop) return stop;
    const results = await searchSnippets(owner.userId, query, { language, limit });
    audit('search_snippets', true, null, { results: results.length });
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
    const stop = gate('get_snippet', 'read');
    if (stop) return stop;
    const snippet = getReadableSnippet(owner.userId, id);
    audit('get_snippet', !!snippet, snippet ? id : null, snippet ? {} : { asked: id });
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
    const stop = gate('list_tags', 'read');
    if (stop) return stop;
    const tags = listReadableTags(owner.userId);
    audit('list_tags', true);
    const text = tags.length ? tags.map(t => `${t.tag} (${t.count})`).join(', ') : 'No tags yet.';
    return { content: [{ type: 'text', text }], structuredContent: { tags } };
  });

  server.registerTool('propose_snippet', {
    title: 'Propose snippet',
    description: 'Suggest a new snippet for the vault. It is NOT saved directly: it goes to a review queue and the user accepts, edits or rejects it.',
    inputSchema: {
      title: z.string().min(1).max(200).describe('Short title, e.g. "Retry fetch with backoff"'),
      code: z.string().min(1).max(100_000),
      language: z.string().min(1).max(40).describe('Language id, e.g. "typescript", "python", "bash"'),
      description: z.string().max(1000).optional().describe('One or two sentences about what it is for'),
      tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    },
    outputSchema: { draft_id: z.number(), status: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (input) => {
    const stop = gate('propose_snippet', 'propose');
    if (stop) return stop;
    if (pendingCount(owner.userId) >= MAX_PENDING) {
      audit('propose_snippet', false, null, { reason: 'queue_full' });
      return { isError: true, content: [{ type: 'text', text: `There are already ${MAX_PENDING} drafts waiting for review. Ask the user to review them first.` }] };
    }
    // stateless http skip initialize, use token name
    const source = server.server.getClientVersion()?.name ?? owner.tokenName;
    const draft = createDraft(owner.userId, owner.tokenId, source, input);
    audit('propose_snippet', true, null, { draft: draft.id });
    return {
      content: [{ type: 'text', text: `Draft #${draft.id} is waiting for the user to review it in SnippetVault (Drafts).` }],
      structuredContent: { draft_id: draft.id, status: draft.status },
    };
  });

  return server;
}
