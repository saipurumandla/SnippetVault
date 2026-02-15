require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), quiet: true });
const { indexAllPlaintext } = require('./indexer');
const { embed } = require('./embedder');

indexAllPlaintext(embed)
  .then(() => { console.log('indexing complete'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
