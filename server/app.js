require('dotenv').config();
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
  max: 20,
  message: { error: 'Too many requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
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

app.use('/', require('./routes/health'));
app.get('/api/ping', (req, res) => {
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`snippetvault server on port ${PORT}`);
});

module.exports = app;
