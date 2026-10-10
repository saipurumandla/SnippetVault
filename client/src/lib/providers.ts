import type { CloudProvider } from '../types';

export const CLOUD: { id: CloudProvider; label: string }[] = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
];
