import { AutoModelForSequenceClassification, AutoTokenizer, type PreTrainedModel, type PreTrainedTokenizer } from '@huggingface/transformers';

export const RERANK_MODEL = process.env.RERANK_MODEL || 'Xenova/ms-marco-MiniLM-L-6-v2';

interface CrossEncoder {
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
}

let loaded: Promise<CrossEncoder> | null = null;

function load(): Promise<CrossEncoder> {
  loaded ??= Promise.all([
    AutoTokenizer.from_pretrained(RERANK_MODEL),
    AutoModelForSequenceClassification.from_pretrained(RERANK_MODEL, { dtype: 'q8' }),
  ]).then(([tokenizer, model]) => ({ tokenizer, model }));
  // failed download should try again next time
  loaded.catch(() => { loaded = null; });
  return loaded;
}

// higher is better, only the order matter
export async function rerankScores(query: string, docs: string[]): Promise<number[]> {
  if (!docs.length) return [];
  const { tokenizer, model } = await load();
  const inputs = tokenizer(new Array(docs.length).fill(query), { text_pair: docs, padding: true, truncation: true, max_length: 256 });
  const { logits } = await model(inputs);
  return (logits.tolist() as number[][]).map(row => row[0]!);
}
