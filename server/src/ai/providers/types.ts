export type ProviderId = 'ollama' | 'anthropic' | 'openai';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string; name: string };

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  tools?: ToolDef[];
  // json schema, ollama force it, cloud only by prompt
  format?: Record<string, unknown>;
  // snippets used in the prompt, cloud guard checks them
  sourceIds?: number[];
}

export interface ChatTurn {
  text: string;
  toolCalls: ToolCall[];
}

export interface ModelProvider {
  readonly id: ProviderId;
  readonly cloud: boolean;
  turn(req: ChatRequest): Promise<ChatTurn>;
  chat(req: ChatRequest): Promise<string>;
  stream(req: ChatRequest, onToken: (token: string) => void): Promise<void>;
  models(): Promise<string[]>;
}

export const MAX_TEMPERATURE = 0.7;

export function clampTemperature(t = 0.2): number {
  return Math.max(0, Math.min(t, MAX_TEMPERATURE));
}

export function splitSystem(messages: ChatMessage[]) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const rest = messages.filter(m => m.role !== 'system') as Exclude<ChatMessage, { role: 'system' }>[];
  return { system, rest };
}

export function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const v = JSON.parse(String(raw || '{}'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
