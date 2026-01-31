import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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

const embedderPath = require.resolve('../rag/embedder.js');
require.cache[embedderPath] = {
  id: embedderPath,
  filename: embedderPath,
  loaded: true,
  exports: { embed: async (text) => fakeEmbed(text) },
};
