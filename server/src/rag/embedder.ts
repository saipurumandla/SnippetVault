import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIMS = 384;

// pipeline() overloads are too big for tsc, give it the one shape we use
const loadPipeline = pipeline as unknown as (
  task: 'feature-extraction', model: string, options: { dtype: 'q8' },
) => Promise<FeatureExtractionPipeline>;

let embedder: Promise<FeatureExtractionPipeline> | null = null;

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  // q8 is what transformers v2 used by default, keep same vectors as before
  embedder ??= loadPipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' });
  return embedder;
}

export async function embed(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
