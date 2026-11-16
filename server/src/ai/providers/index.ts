import { OllamaProvider } from './ollama.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import type { ModelProvider, ProviderId } from './types.js';

export type * from './types.js';

export const ollama = new OllamaProvider();

export const DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'qwen3.6:27b';

export function cloudProvider(id: Exclude<ProviderId, 'ollama'>, apiKey: string, fetchImpl?: typeof fetch): ModelProvider {
  if (!apiKey) throw new Error(`No API key set for ${id}`);
  return id === 'anthropic' ? new AnthropicProvider(apiKey, fetchImpl) : new OpenAIProvider(apiKey, fetchImpl);
}

// only models ollama has, not any name user send
export async function localModel(requested?: string): Promise<string> {
  const model = requested || DEFAULT_MODEL;
  const installed = await ollama.models();
  if (!installed.includes(model)) throw new Error(`Model not installed in Ollama: ${model}`);
  return model;
}
