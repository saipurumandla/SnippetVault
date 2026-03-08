import '../config.js';
import { indexAllPlaintext } from './indexer.js';
import { embed } from './embedder.js';

indexAllPlaintext(embed)
  .then((n) => { console.log(`indexed ${n} snippets`); process.exit(0); })
  .catch((err: unknown) => { console.error(err); process.exit(1); });
