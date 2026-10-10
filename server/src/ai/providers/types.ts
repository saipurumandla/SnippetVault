export type ProviderId = 'ollama' | 'anthropic' | 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  // snippets used in the prompt, cloud guard checks them
  sourceIds?: number[];
}

export interface ModelProvider {
  readonly id: ProviderId;
  readonly cloud: boolean;
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
  const rest = messages.filter(m => m.role !== 'system') as { role: 'user' | 'assistant'; content: string }[];
  return { system, rest };
}
