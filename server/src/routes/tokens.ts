import express from 'express';
import { z } from 'zod';
import auth from '../middleware/authMiddleware.js';
import { validate } from '../validation.js';
import { SCOPES, createToken, listTokens, revokeToken } from '../tokens.js';

const router = express.Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(SCOPES)).min(1),
});

router.get('/', auth, (req, res) => {
  res.json(listTokens(req.user!.id));
});

router.post('/', auth, validate(createSchema), (req, res) => {
  const { name, scopes } = req.body as z.infer<typeof createSchema>;
  const { token, record } = createToken(req.user!.id, name, scopes);
  res.status(201).json({ ...record, token });
});

router.delete('/:id', auth, (req, res) => {
  if (!revokeToken(req.user!.id, Number(req.params.id))) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(204).end();
});

export default router;
