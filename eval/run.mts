// npm run eval, first run download the two models
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface Item { key: string; title: string; language: string; tags: string[]; code: string }
interface Question { q: string; kind: 'keyword' | 'paraphrase'; relevant: string[] }

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'sv-eval-')), 'eval.db');
process.env.JWT_SECRET ??= 'eval';
process.env.LOG_LEVEL = 'silent';
// index ourself below, app indexing is fire and forget
process.env.EMBEDDINGS = 'off';

const dir = new URL('.', import.meta.url).pathname;
const corpus = JSON.parse(readFileSync(join(dir, 'corpus.json'), 'utf8')) as Item[];
const questions = JSON.parse(readFileSync(join(dir, 'questions.json'), 'utf8')) as Question[];

const { default: db } = await import('../server/src/db.ts');
const { config } = await import('../server/src/config.ts');
const { createSnippet } = await import('../server/src/snippets.ts');
const { indexSnippet } = await import('../server/src/rag/indexer.ts');
const { embed, EMBED_MODEL } = await import('../server/src/rag/embedder.ts');
const { retrieve } = await import('../server/src/rag/retriever.ts');
const { RERANK_MODEL } = await import('../server/src/rag/rerank.ts');

const userId = Number(db.prepare("INSERT INTO users (email, password_hash, created_at) VALUES ('eval@example.com', 'x', ?)").run(new Date().toISOString()).lastInsertRowid);
const keyOf = new Map<number, string>();
for (const item of corpus) {
  const s = createSnippet(userId, { title: item.title, code: item.code, language: item.language, visibility: 'private', encryption_mode: 'standard' }, item.tags);
  keyOf.set(s.id, item.key);
}

config.embeddings = true;
for (const id of keyOf.keys()) await indexSnippet(db.prepare('SELECT * FROM snippets WHERE id = ?').get(id) as never, embed);

for (const q of questions) {
  const unknown = q.relevant.filter(k => !corpus.some(c => c.key === k));
  if (unknown.length) throw new Error(`question "${q.q}" points to missing keys: ${unknown.join(', ')}`);
}

const MODES = [
  { name: 'Keyword only (FTS5)', embeddings: false, rerank: false },
  { name: 'Hybrid (FTS5 + vectors), default', embeddings: true, rerank: false },
  { name: 'Hybrid + reranker (RERANK=on)', embeddings: true, rerank: true },
];

interface Row { mode: string; r1: number; r3: number; r5: number; mrr: number; mrrKeyword: number; mrrParaphrase: number; ms: number; misses: string[] }
const rows: Row[] = [];

for (const mode of MODES) {
  config.embeddings = mode.embeddings;
  config.rerank = mode.rerank;
  // first call load models, dont count it
  await retrieve('warm up', userId);

  let r1 = 0, r3 = 0, r5 = 0, ms = 0;
  const rr: Record<Question['kind'], number[]> = { keyword: [], paraphrase: [] };
  const misses: string[] = [];
  for (const q of questions) {
    const started = performance.now();
    const { chunks } = await retrieve(q.q, userId);
    ms += performance.now() - started;
    const ranked = [...new Set(chunks.map(c => keyOf.get(c.snippet_id)!))];
    const recall = (k: number) => q.relevant.filter(r => ranked.slice(0, k).includes(r)).length / q.relevant.length;
    r1 += recall(1); r3 += recall(3); r5 += recall(5);
    const first = ranked.findIndex(k => q.relevant.includes(k));
    rr[q.kind].push(first === -1 ? 0 : 1 / (first + 1));
    if (first === -1) misses.push(q.q);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const n = questions.length;
  rows.push({
    mode: mode.name, r1: r1 / n, r3: r3 / n, r5: r5 / n,
    mrr: avg([...rr.keyword, ...rr.paraphrase]), mrrKeyword: avg(rr.keyword), mrrParaphrase: avg(rr.paraphrase),
    ms: ms / n, misses,
  });
}

const f = (x: number) => x.toFixed(3);
const kinds = { keyword: questions.filter(q => q.kind === 'keyword').length, paraphrase: questions.filter(q => q.kind === 'paraphrase').length };
const best = rows.find(r => r.mode.endsWith('default'))!;
const report = `# Retrieval eval

${corpus.length} snippets in ${new Set(corpus.map(c => c.language)).size} languages, ${questions.length} labelled questions
(${kinds.keyword} use the snippet words, ${kinds.paraphrase} say it another way). Questions and labels are in
\`eval/questions.json\`, no model judges anything. Run it with \`npm run eval\`.

| Mode | Recall@1 | Recall@3 | Recall@5 | MRR@5 | MRR keyword | MRR paraphrase | ms / query |
|---|---|---|---|---|---|---|---|
${rows.map(r => `| ${r.mode} | ${f(r.r1)} | ${f(r.r3)} | ${f(r.r5)} | ${f(r.mrr)} | ${f(r.mrrKeyword)} | ${f(r.mrrParaphrase)} | ${r.ms.toFixed(0)} |`).join('\n')}

- Recall@k: part of the relevant snippets that are in the first k results, averaged over questions
- MRR@5: 1 / rank of the first relevant snippet, 0 if none in the top 5
- Models: embeddings \`${EMBED_MODEL}\`, reranker \`${RERANK_MODEL}\`, both q8 on CPU

## Not found in the top 5 (default mode)

${best.misses.length ? best.misses.map(m => `- ${m}`).join('\n') : 'None.'}
`;

writeFileSync(join(dir, 'REPORT.md'), report);
console.log(report);
