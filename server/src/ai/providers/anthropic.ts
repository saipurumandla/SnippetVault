import Anthropic from '@anthropic-ai/sdk';
import { clampTemperature, splitSystem, type ChatMessage, type ChatRequest, type ChatTurn, type ModelProvider } from './types.js';

type Wire = Anthropic.MessageParam;

// tool results go in one user message after the calls
function toWire(messages: Exclude<ChatMessage, { role: 'system' }>[]): Wire[] {
  const out: Wire[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const result: Anthropic.ToolResultBlockParam = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
      const last = out[out.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content) && last.content.every(b => b.type === 'tool_result')) last.content.push(result);
      else out.push({ role: 'user', content: [result] });
    } else if (m.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.arguments });
      out.push({ role: 'assistant', content: blocks.length ? blocks : '' });
    } else {
      const last = out[out.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content)) last.content.push({ type: 'text', text: m.content });
      else out.push({ role: 'user', content: m.content });
    }
  }
  return out;
}

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
      messages: toWire(rest),
      ...(req.tools?.length ? { tools: req.tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Tool.InputSchema })) } : {}),
    };
  }

  async turn(req: ChatRequest): Promise<ChatTurn> {
    const msg = await this.client.messages.create(this.params(req), { signal: req.signal });
    return {
      text: msg.content.map(b => (b.type === 'text' ? b.text : '')).join(''),
      toolCalls: msg.content.flatMap(b => (b.type === 'tool_use' ? [{ id: b.id, name: b.name, arguments: (b.input ?? {}) as Record<string, unknown> }] : [])),
    };
  }

  async chat(req: ChatRequest): Promise<string> {
    return (await this.turn({ ...req, tools: undefined })).text;
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
