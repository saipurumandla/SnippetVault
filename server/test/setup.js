import { vi } from 'vitest';
import dotenv from 'dotenv';

// fake keys for secret filter tests, see .env.test.example
dotenv.config({ path: new URL('./.env.test', import.meta.url).pathname, quiet: true });

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.LOG_LEVEL = 'silent';
process.env.MASTER_KEY = 'ab'.repeat(32);

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

// cross encoder is 23mb too, word overlap is enough for tests
vi.mock('../src/rag/rerank.js', () => ({
  rerankScores: vi.fn(async (query, docs) => {
    const words = query.toLowerCase().split(/\W+/).filter(Boolean);
    return docs.map(d => words.filter(w => d.toLowerCase().includes(w)).length);
  }),
}));

// tests never talk to a real ollama, even if it run
vi.mock('../src/ai/providers/ollama.js', () => ({
  OllamaProvider: class {
    id = 'ollama';
    cloud = false;
    async models() { return ['qwen3-coder:30b']; }
    async chat({ messages, format }) {
      if (format) return '{"tags": ["Stub-Tag", "python", "data"]}';
      const id = messages.map(m => m.content).join('\n').match(/\[snippet:(\d+)\]/)?.[1];
      return id ? `stub answer [snippet:${id}]` : 'stub answer';
    }
    async stream(_req, onToken) { onToken('stub'); }
    async turn(req) { return { text: await this.chat(req), toolCalls: [] }; }
  },
}));
