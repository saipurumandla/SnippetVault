import { describe, it, expect } from 'vitest';
import { app, request, newUser } from './helpers.js';
import db from '../src/db.ts';
import { verifyAccessToken } from '../src/tokens.ts';

describe('access tokens', () => {
  it('creates a token, shows it once, stores only a hash', async () => {
    const u = await newUser();
    const res = await request(app).post('/api/tokens').set('Authorization', u.auth).send({ name: 'work laptop', scopes: ['read'] });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^sv_[\w-]{40,}$/);
    expect(res.body.scopes).toEqual(['read']);

    const row = db.prepare('SELECT * FROM access_tokens WHERE id = ?').get(res.body.id);
    expect(row.token_hash).not.toContain(res.body.token);
    expect(JSON.stringify(row)).not.toContain(res.body.token);

    const list = await request(app).get('/api/tokens').set('Authorization', u.auth);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].token).toBeUndefined();
    expect(list.body[0].prefix).toBe(res.body.token.slice(0, 10));
  });

  it('verifies, records last use, and stops after revoke', async () => {
    const u = await newUser();
    const { body } = await request(app).post('/api/tokens').set('Authorization', u.auth).send({ name: 'cursor', scopes: ['read', 'propose'] });
    const owner = verifyAccessToken(body.token);
    expect(owner).toMatchObject({ userId: u.id, email: u.email, tokenName: 'cursor', scopes: ['read', 'propose'] });
    expect(db.prepare('SELECT last_used_at FROM access_tokens WHERE id = ?').get(body.id).last_used_at).toBeTruthy();

    expect((await request(app).delete(`/api/tokens/${body.id}`).set('Authorization', u.auth)).status).toBe(204);
    expect(verifyAccessToken(body.token)).toBeNull();
    expect((await request(app).delete(`/api/tokens/${body.id}`).set('Authorization', u.auth)).status).toBe(404);
  });

  it('rejects bad input and other people tokens', async () => {
    const a = await newUser();
    const b = await newUser();
    expect((await request(app).post('/api/tokens').set('Authorization', a.auth).send({ name: 'x', scopes: ['admin'] })).status).toBe(400);
    expect((await request(app).post('/api/tokens').set('Authorization', a.auth).send({ name: ' ', scopes: ['read'] })).status).toBe(400);
    const { body } = await request(app).post('/api/tokens').set('Authorization', a.auth).send({ name: 'mine', scopes: ['read'] });
    expect((await request(app).delete(`/api/tokens/${body.id}`).set('Authorization', b.auth)).status).toBe(404);
    expect(verifyAccessToken('sv_not-a-real-token')).toBeNull();
    expect(verifyAccessToken(body.token.replace('sv_', 'xx_'))).toBeNull();
  });
});
