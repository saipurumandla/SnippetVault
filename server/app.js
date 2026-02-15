const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

const PORT = process.env.PORT || 3001;

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/share', sensitiveLimiter);
app.use('/api/snippets', require('./routes/snippets'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/share', require('./routes/share'));  // limiter mounted above
app.use('/api/expired', require('./routes/expired'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/rag', require('./routes/rag'));
app.use('/api/security', require('./routes/security'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/stream', require('./routes/stream'));

app.use('/', require('./routes/health'));
app.get('/api/ping', (req, res) => {
  res.json({ ok: true });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`snippetvault server on port ${PORT}`);
  });
}

module.exports = app;
