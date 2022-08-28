const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8),
});

const snippetSchema = z.object({
  title: z.string().min(1).max(200),
  code: z.string().min(1),
  language: z.string().min(1),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['private', 'project', 'shared']).optional(),
  encryption_mode: z.enum(['standard', 'sensitive']).optional(),
  project_id: z.number().int().positive().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  wrapped_key: z.string().optional().nullable(),
});

const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const shareSchema = z.object({
  recipients: z.array(z.number().int().positive()).min(1),
  payload: z.object({
    ciphertext: z.string(),
    nonce: z.string(),
  }),
  expires_at: z.string().datetime().optional().nullable(),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { registerSchema, snippetSchema, projectSchema, shareSchema, validate };
