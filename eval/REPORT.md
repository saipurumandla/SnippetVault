# Retrieval eval

42 snippets in 13 languages, 52 labelled questions
(18 use the snippet words, 34 say it another way). Questions and labels are in
`eval/questions.json`, no model judges anything. Run it with `npm run eval`.

| Mode | Recall@1 | Recall@3 | Recall@5 | MRR@5 | MRR keyword | MRR paraphrase | ms / query |
|---|---|---|---|---|---|---|---|
| Keyword only (FTS5) | 0.139 | 0.471 | 0.558 | 0.314 | 0.347 | 0.296 | 0 |
| Hybrid (FTS5 + vectors) | 0.630 | 0.731 | 0.870 | 0.733 | 0.861 | 0.665 | 2 |
| Hybrid + reranker | 0.813 | 0.861 | 0.899 | 0.855 | 1.000 | 0.778 | 76 |

- Recall@k: part of the relevant snippets that are in the first k results, averaged over questions
- MRR@5: 1 / rank of the first relevant snippet, 0 if none in the top 5
- Models: embeddings `Xenova/all-MiniLM-L6-v2`, reranker `Xenova/ms-marco-MiniLM-L-6-v2`, both q8 on CPU

## Not found in the top 5 (hybrid + reranker)

- give up on a request that hangs too long
- only run the search after the user stops typing
- load a spreadsheet export into python
- store passwords safely
- strictest typescript compiler settings
