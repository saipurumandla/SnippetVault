import OpenAI from 'openai';
import { clampTemperature, type ChatRequest, type ModelProvider } from './types.js';

export class OpenAIProvider implements ModelProvider {
  readonly id = 'openai' as const;
  readonly cloud = true;
  private readonly client: OpenAI;

  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    this.client = new OpenAI({ apiKey, fetch: fetchImpl, maxRetries: 1 });
  }

  async chat(req: ChatRequest): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages,
      temperature: clampTemperature(req.temperature),
      ...(req.maxTokens ? { max_completion_tokens: req.maxTokens } : {}),
    }, { signal: req.signal });
    return res.choices[0]?.message.content ?? '';
  }

  async stream(req: ChatRequest, onToken: (token: string) => void): Promise<void> {
    const stream = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages,
      temperature: clampTemperature(req.temperature),
      stream: true,
    }, { signal: req.signal });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) onToken(text);
    }
  }

  async models(): Promise<string[]> {
    const ids: string[] = [];
    for await (const m of this.client.models.list()) ids.push(m.id);
    return ids.sort();
  }
}
