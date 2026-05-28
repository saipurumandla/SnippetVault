import { config, isMain } from './config.js';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import './types.js';
import authRoutes from './routes/auth.js';
import snippetRoutes from './routes/snippets.js';
import tagRoutes from './routes/tags.js';
import projectRoutes from './routes/projects.js';
import shareRoutes from './routes/share.js';
import expiredRoutes from './routes/expired.js';
import backupRoutes from './routes/backup.js';
import ragRoutes from './routes/rag.js';
import securityRoutes from './routes/security.js';
import assistantRoutes from './routes/assistant.js';
import streamRoutes from './routes/stream.js';
import healthRoutes from './routes/health.js';
import tokenRoutes from './routes/tokens.js';
import draftRoutes from './routes/drafts.js';
import mcpRoutes from './routes/mcp.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/share', sensitiveLimiter, shareRoutes);
app.use('/api/snippets', snippetRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/expired', expiredRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/mcp', mcpRoutes);
app.use('/', healthRoutes);

app.get('/api/ping', (req, res) => {
  res.json({ ok: true });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

if (isMain(import.meta.url)) {
  app.listen(config.port, () => {
    console.log(`snippetvault server on port ${config.port}`);
  });
}

export default app;
