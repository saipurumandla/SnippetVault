import OpenAI from 'openai';
import { clampTemperature, parseArgs, type ChatMessage, type ChatRequest, type ChatTurn, type ModelProvider } from './types.js';

function toWire(m: ChatMessage): OpenAI.ChatCompletionMessageParam {
  if (m.role === 'assistant') {
    return {
      role: 'assistant',
      content: m.content || null,
      ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map(c => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: JSON.stringify(c.arguments) } })) } : {}),
    };
  }
  if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
  return { role: m.role, content: m.content };
}

export class OpenAIProvider implements ModelProvider {
  readonly id = 'openai' as const;
  readonly cloud = true;
  private readonly client: OpenAI;

  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    this.client = new OpenAI({ apiKey, fetch: fetchImpl, maxRetries: 1 });
  }

  async turn(req: ChatRequest): Promise<ChatTurn> {
    const res = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages.map(toWire),
      temperature: clampTemperature(req.temperature),
      ...(req.maxTokens ? { max_completion_tokens: req.maxTokens } : {}),
      ...(req.tools?.length ? { tools: req.tools.map(t => ({ type: 'function' as const, function: t })) } : {}),
    }, { signal: req.signal });
    const msg = res.choices[0]?.message;
    return {
      text: msg?.content ?? '',
      toolCalls: (msg?.tool_calls ?? []).flatMap(c => (c.type === 'function' ? [{ id: c.id, name: c.function.name, arguments: parseArgs(c.function.arguments) }] : [])),
    };
  }

  async chat(req: ChatRequest): Promise<string> {
    return (await this.turn({ ...req, tools: undefined })).text;
  }

  async stream(req: ChatRequest, onToken: (token: string) => void): Promise<void> {
    const stream = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages.map(toWire),
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
