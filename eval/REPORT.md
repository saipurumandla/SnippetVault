# Retrieval eval

42 snippets in 13 languages, 52 labelled questions
(18 use the snippet words, 34 say it another way). Questions and labels are in
`eval/questions.json`, no model judges anything. Run it with `npm run eval`.

| Mode | Recall@1 | Recall@3 | Recall@5 | MRR@5 | MRR keyword | MRR paraphrase | ms / query |
|---|---|---|---|---|---|---|---|
| Keyword only (FTS5) | 0.736 | 0.798 | 0.851 | 0.793 | 1.000 | 0.684 | 0 |
| Hybrid (FTS5 + vectors), default | 0.832 | 0.880 | 0.918 | 0.870 | 1.000 | 0.801 | 2 |
| Hybrid + reranker (RERANK=on) | 0.813 | 0.861 | 0.880 | 0.851 | 1.000 | 0.772 | 74 |

- Recall@k: part of the relevant snippets that are in the first k results, averaged over questions
- MRR@5: 1 / rank of the first relevant snippet, 0 if none in the top 5
- Models: embeddings `Xenova/all-MiniLM-L6-v2`, reranker `Xenova/ms-marco-MiniLM-L-6-v2`, both q8 on CPU

## Not found in the top 5 (default mode)

- give up on a request that hangs too long
- return json instead of html when a route throws
- store passwords safely
- strictest typescript compiler settings
