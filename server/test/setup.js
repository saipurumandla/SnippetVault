import { vi } from 'vitest';

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.LOG_LEVEL = 'silent';

// real embedder download a 90mb model, too slow for tests
function fakeEmbed(text) {
  const v = new Array(384).fill(0);
  for (const word of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    let h = 0;
    for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % 384;
    v[h] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / norm);
}

vi.mock('../src/rag/embedder.js', () => ({ embed: async (text) => fakeEmbed(text) }));

// tests never talk to a real ollama, even if it run
vi.mock('../src/ai/ollamaClient.js', async (importOriginal) => ({
  ...(await importOriginal()),
  health: async () => false,
  generate: async ({ prompt }) => {
    const id = prompt.match(/\[snippet:(\d+)\]/)?.[1];
    return id ? `stub answer [snippet:${id}]` : 'stub answer';
  },
  generateStream: ({ onToken, onDone }) => { onToken('stub'); onDone(); },
}));
