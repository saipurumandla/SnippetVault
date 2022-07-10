require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.use('/api/auth', require('./routes/auth'));
app.use('/api/snippets', require('./routes/snippets'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/share', require('./routes/share'));

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
