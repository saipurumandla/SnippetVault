import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIMS = 384;

// pipeline() types too big for tsc, use one shape
const loadPipeline = pipeline as unknown as (
  task: 'feature-extraction', model: string, options: { dtype: 'q8' },
) => Promise<FeatureExtractionPipeline>;

let embedder: Promise<FeatureExtractionPipeline> | null = null;

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  // q8 was the v2 default, keep same vectors
  embedder ??= loadPipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' });
  return embedder;
}

export async function embed(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
