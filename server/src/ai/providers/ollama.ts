import { clampTemperature, type ChatRequest, type ModelProvider } from './types.js';

interface OllamaChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama' as const;
  readonly cloud = false;
  private modelCache: { at: number; names: string[] } | null = null;

  constructor(private readonly baseUrl = `http://${process.env.OLLAMA_HOST || 'localhost'}:${process.env.OLLAMA_PORT || '11434'}`) {}

  private body(req: ChatRequest, stream: boolean) {
    return JSON.stringify({
      model: req.model,
      messages: req.messages,
      stream,
      options: { temperature: clampTemperature(req.temperature), ...(req.maxTokens ? { num_predict: req.maxTokens } : {}) },
    });
  }

  private async post(req: ChatRequest, stream: boolean): Promise<Response> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: this.body(req, stream),
      signal: req.signal,
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
  }

  async chat(req: ChatRequest): Promise<string> {
    const data = (await (await this.post(req, false)).json()) as OllamaChunk;
    if (data.error) throw new Error(data.error);
    return data.message?.content ?? '';
  }

  async stream(req: ChatRequest, onToken: (token: string) => void): Promise<void> {
    const res = await this.post(req, true);
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const part of res.body!) {
      buffer += decoder.decode(part, { stream: true });
      const lines = buffer.split('\n');
      // last line can be half, keep it for next chunk
      buffer = lines.pop() ?? '';
      for (const line of lines.filter(Boolean)) {
        const chunk = JSON.parse(line) as OllamaChunk;
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.message?.content) onToken(chunk.message.content);
      }
    }
  }

  async models(): Promise<string[]> {
    if (this.modelCache && Date.now() - this.modelCache.at < 30_000) return this.modelCache.names;
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const { models = [] } = (await res.json()) as { models?: { name: string }[] };
      this.modelCache = { at: Date.now(), names: models.map(m => m.name) };
      return this.modelCache.names;
    } catch {
      return [];
    }
  }
}
