import Anthropic from '@anthropic-ai/sdk';
import { clampTemperature, splitSystem, type ChatRequest, type ModelProvider } from './types.js';

export class AnthropicProvider implements ModelProvider {
  readonly id = 'anthropic' as const;
  readonly cloud = true;
  private readonly client: Anthropic;

  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    this.client = new Anthropic({ apiKey, fetch: fetchImpl, maxRetries: 1 });
  }

  private params(req: ChatRequest) {
    const { system, rest } = splitSystem(req.messages);
    return {
      model: req.model,
      max_tokens: req.maxTokens ?? 2048,
      temperature: clampTemperature(req.temperature),
      ...(system ? { system } : {}),
      messages: rest,
    };
  }

  async chat(req: ChatRequest): Promise<string> {
    const msg = await this.client.messages.create(this.params(req), { signal: req.signal });
    return msg.content.map(b => (b.type === 'text' ? b.text : '')).join('');
  }

  async stream(req: ChatRequest, onToken: (token: string) => void): Promise<void> {
    const stream = this.client.messages.stream(this.params(req), { signal: req.signal });
    stream.on('text', onToken);
    await stream.finalMessage();
  }

  async models(): Promise<string[]> {
    const ids: string[] = [];
    for await (const m of this.client.models.list({ limit: 100 })) ids.push(m.id);
    return ids;
  }
}
