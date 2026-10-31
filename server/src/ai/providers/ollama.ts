import { clampTemperature, parseArgs, type ChatMessage, type ChatRequest, type ChatTurn, type ModelProvider } from './types.js';

interface OllamaChunk {
  message?: { content?: string; tool_calls?: { id?: string; function: { name: string; arguments: unknown } }[] };
  done?: boolean;
  error?: string;
}

const TEXT_CALL = /<function=([\w-]+)>([\s\S]*?)<\/function>/g;
const TEXT_PARAM = /<parameter=([\w-]+)>\s*([\s\S]*?)\s*<\/parameter>/g;

// qwen3-coder put some tool calls in text, ollama miss them
export function callsInText(text: string): { text: string; calls: { name: string; arguments: Record<string, unknown> }[] } {
  const calls = [...text.matchAll(TEXT_CALL)].map(m => ({
    name: m[1]!,
    arguments: Object.fromEntries([...m[2]!.matchAll(TEXT_PARAM)].map(p => {
      const raw = p[2]!;
      return [p[1]!, /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw];
    })),
  }));
  const rest = text.replace(TEXT_CALL, '').replace(/<\/?tool_call>/g, '').trim();
  return { text: calls.length ? rest : text, calls };
}

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama' as const;
  readonly cloud = false;
  private modelCache: { at: number; names: string[] } | null = null;

  constructor(private readonly baseUrl = `http://${process.env.OLLAMA_HOST || 'localhost'}:${process.env.OLLAMA_PORT || '11434'}`) {}

  private static wire(m: ChatMessage) {
    if (m.role === 'assistant') {
      return { role: m.role, content: m.content, ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map(c => ({ function: { name: c.name, arguments: c.arguments } })) } : {}) };
    }
    if (m.role === 'tool') return { role: 'tool', content: m.content, tool_name: m.name };
    return m;
  }

  private body(req: ChatRequest, stream: boolean) {
    return JSON.stringify({
      model: req.model,
      messages: req.messages.map(OllamaProvider.wire),
      stream,
      ...(req.tools?.length ? { tools: req.tools.map(t => ({ type: 'function', function: t })) } : {}),
      ...(req.format ? { format: req.format } : {}),
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

  async turn(req: ChatRequest): Promise<ChatTurn> {
    const data = (await (await this.post(req, false)).json()) as OllamaChunk;
    if (data.error) throw new Error(data.error);
    const parsed = (data.message?.tool_calls ?? []).map((c, i) => ({ id: c.id ?? `call_${i}`, name: c.function.name, arguments: parseArgs(c.function.arguments) }));
    const content = data.message?.content ?? '';
    if (!req.tools?.length) return { text: content, toolCalls: parsed };

    const fromText = callsInText(content);
    const key = (c: { name: string; arguments: unknown }) => c.name + JSON.stringify(c.arguments);
    const known = new Set(parsed.map(key));
    const extra = fromText.calls.filter(c => !known.has(key(c))).map((c, i) => ({ id: `text_call_${i}`, ...c }));
    return { text: fromText.text, toolCalls: [...parsed, ...extra] };
  }

  async chat(req: ChatRequest): Promise<string> {
    return (await this.turn({ ...req, tools: undefined })).text;
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
