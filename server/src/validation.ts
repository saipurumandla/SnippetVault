import { z } from 'zod';
import type { RequestHandler } from 'express';

export const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8),
});

export const snippetSchema = z.object({
  title: z.string().min(1).max(200),
  code: z.string().min(1),
  language: z.string().min(1),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['private', 'project', 'shared']).optional(),
  encryption_mode: z.enum(['standard', 'sensitive']).optional(),
  project_id: z.number().int().positive().optional().nullable(),
  expires_at: z.iso.datetime().optional().nullable(),
  wrapped_key: z.string().optional().nullable(),
});

export const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const shareSchema = z.object({
  recipients: z.array(z.number().int().positive()).min(1),
  payload: z.object({
    ciphertext: z.string(),
    nonce: z.string(),
  }),
  expires_at: z.iso.datetime().optional().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type SnippetInput = z.infer<typeof snippetSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ShareInput = z.infer<typeof shareSchema>;

export function validate(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    req.body = result.data;
    next();
  };
}
