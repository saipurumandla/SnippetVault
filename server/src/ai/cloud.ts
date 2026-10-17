import db from '../db.js';
import { openSecret } from '../keystore.js';
import { redactSecrets } from './safetyFilters.js';
import { cloudProvider, localModel, ollama } from './providers/index.js';
import type { ChatRequest, ModelProvider, ProviderId } from './providers/types.js';

export type CloudId = Exclude<ProviderId, 'ollama'>;
export const CLOUD_IDS: CloudId[] = ['anthropic', 'openai'];

export class CloudBlocked extends Error {
  readonly status = 403;
}

interface SnippetScope {
  id: number;
  encryption_mode: string;
  project_id: number | null;
  author_id: number;
}

export function hasConsent(s: Pick<SnippetScope, 'project_id' | 'author_id'>, provider: CloudId): boolean {
  const row = s.project_id
    ? db.prepare('SELECT 1 FROM cloud_consent WHERE project_id = ? AND provider = ?').get(s.project_id, provider)
    : db.prepare('SELECT 1 FROM cloud_consent WHERE project_id IS NULL AND granted_by = ? AND provider = ?').get(s.author_id, provider);
  return !!row;
}

function scopeOf(id: number): SnippetScope | undefined {
  return db.prepare('SELECT id, encryption_mode, project_id, author_id FROM snippets WHERE id = ?').get(id) as SnippetScope | undefined;
}

export function assertSources(provider: CloudId, sourceIds: number[] | undefined) {
  if (!sourceIds) throw new CloudBlocked('Cloud request without a source list');
  for (const id of sourceIds) {
    const s = scopeOf(id);
    if (!s) throw new CloudBlocked(`Unknown snippet #${id}`);
    if (s.encryption_mode === 'sensitive') throw new CloudBlocked(`Sensitive snippet #${id} never goes to a cloud model`);
    if (!hasConsent(s, provider)) throw new CloudBlocked(`No consent to send snippet #${id} to ${provider}`);
  }
}

// last check before data leave, routes can have bugs
export class GuardedProvider implements ModelProvider {
  readonly cloud = true;
  constructor(private readonly inner: ModelProvider & { id: CloudId }) {}

  get id() {
    return this.inner.id;
  }

  check(req: ChatRequest): ChatRequest {
    assertSources(this.inner.id, req.sourceIds);
    return { ...req, messages: req.messages.map(m => ({ ...m, content: redactSecrets(m.content) })) };
  }

  async turn(req: ChatRequest) {
    return this.inner.turn(this.check(req));
  }

  async chat(req: ChatRequest) {
    return this.inner.chat(this.check(req));
  }

  async stream(req: ChatRequest, onToken: (t: string) => void) {
    return this.inner.stream(this.check(req), onToken);
  }

  models() {
    return this.inner.models();
  }
}

export interface Assistant {
  provider: ModelProvider;
  model: string;
}

export function chosenProvider(userId: number): ProviderId {
  const row = db.prepare('SELECT provider FROM ai_settings WHERE user_id = ?').get(userId) as { provider: ProviderId } | undefined;
  return row?.provider ?? 'ollama';
}

export function cloudFor(userId: number, id: CloudId, fetchImpl?: typeof fetch): Assistant {
  const key = db.prepare('SELECT key_enc, model FROM ai_keys WHERE user_id = ? AND provider = ?').get(userId, id) as { key_enc: string; model: string } | undefined;
  if (!key) throw new CloudBlocked(`No ${id} API key saved, add one in Settings`);
  return { provider: new GuardedProvider(cloudProvider(id, openSecret(key.key_enc), fetchImpl) as ModelProvider & { id: CloudId }), model: key.model };
}

export async function assistantFor(userId: number, requestedLocalModel?: string): Promise<Assistant> {
  const id = chosenProvider(userId);
  if (id === 'ollama') return { provider: ollama, model: await localModel(requestedLocalModel) };
  return cloudFor(userId, id);
}

// drop what cloud may not see, guard still check again
export function allowedSources<T extends { snippet_id: number }>(assistant: Assistant, chunks: T[]): T[] {
  if (!assistant.provider.cloud) return chunks;
  const id = assistant.provider.id as CloudId;
  return chunks.filter(c => {
    const s = scopeOf(c.snippet_id);
    return !!s && s.encryption_mode === 'standard' && hasConsent(s, id);
  });
}
