CREATE VIRTUAL TABLE IF NOT EXISTS rag_vec USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding float[384] distance_metric=cosine
);

INSERT INTO rag_vec (chunk_id, embedding)
SELECT chunk_id, embedding FROM rag_embeddings WHERE dims = 384;

DROP TABLE rag_embeddings;
