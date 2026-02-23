import '../config.js';
import { indexAllPlaintext } from './indexer.js';
import { embed } from './embedder.js';

indexAllPlaintext(embed)
  .then(() => { console.log('indexing complete'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
