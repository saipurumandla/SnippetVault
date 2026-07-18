import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';

async function tokenFor(user, scopes) {
  const res = await request(app).post('/api/tokens').set('Authorization', user.auth).send({ name: 'cli', scopes });
  return `Bearer ${res.body.token}`;
}

describe('rest api with access tokens', () => {
  it('reads with read scope and hides sensitive snippets', async () => {
    const u = await newUser();
    const plain = await newSnippet(u, { title: 'Retry helper' });
    const secret = await newSnippet(u, { title: 'Prod env', encryption_mode: 'sensitive', wrapped_key: 'sealed', code: 'Y2lwaGVy' });
    const pat = await tokenFor(u, ['read']);

    const list = await request(app).get('/api/snippets').set('Authorization', pat);
    expect(list.status).toBe(200);
    expect(list.body.map(s => s.id)).toEqual([plain.id]);

    expect((await request(app).get(`/api/snippets/${plain.id}`).set('Authorization', pat)).status).toBe(200);
    expect((await request(app).get(`/api/snippets/${secret.id}`).set('Authorization', pat)).status).toBe(404);
    expect((await request(app).get('/api/snippets?q=prod').set('Authorization', pat)).body).toEqual([]);
  });

  it('needs write scope to change things', async () => {
    const u = await newUser();
    const read = await tokenFor(u, ['read']);
    const write = await tokenFor(u, ['read', 'write']);
    const body = { title: 'From terminal', code: 'echo hi', language: 'bash' };

    const denied = await request(app).post('/api/snippets').set('Authorization', read).send(body);
    expect(denied.status).toBe(403);
    expect(denied.body.error).toMatch(/write scope/);

    const made = await request(app).post('/api/snippets').set('Authorization', write).send(body);
    expect(made.status).toBe(201);
    expect((await request(app).post(`/api/tags/${made.body.id}`).set('Authorization', write).send({ tag: 'shell' })).status).toBe(201);
  });

  it('cant make or touch sensitive snippets', async () => {
    const u = await newUser();
    const secret = await newSnippet(u, { encryption_mode: 'sensitive', wrapped_key: 'sealed', code: 'Y2lwaGVy' });
    const pat = await tokenFor(u, ['read', 'write']);

    const made = await request(app).post('/api/snippets').set('Authorization', pat)
      .send({ title: 'x', code: 'x', language: 'bash', encryption_mode: 'sensitive', wrapped_key: 'k' });
    expect(made.status).toBe(400);
    expect((await request(app).delete(`/api/snippets/${secret.id}`).set('Authorization', pat)).status).toBe(404);
    expect((await request(app).put(`/api/snippets/${secret.id}`).set('Authorization', pat).send({ title: 'y' })).status).toBe(404);
    expect((await request(app).post(`/api/tags/${secret.id}`).set('Authorization', pat).send({ tag: 'leak' })).status).toBe(404);
  });

  it('keeps web only routes closed', async () => {
    const u = await newUser();
    const pat = await tokenFor(u, ['read', 'propose', 'write']);
    for (const path of ['/api/tokens', '/api/backup/export', '/api/security/events', '/api/drafts', '/api/expired']) {
      const res = await request(app).get(path).set('Authorization', pat);
      expect(res.status, path).toBe(403);
    }
    expect((await request(app).post('/api/tokens').set('Authorization', pat).send({ name: 'more', scopes: ['write'] })).status).toBe(403);
  });

  it('tells who the token belongs to', async () => {
    const u = await newUser();
    const pat = await tokenFor(u, ['read']);
    const me = await request(app).get('/api/tokens/current').set('Authorization', pat);
    expect(me.body).toEqual({ name: 'cli', scopes: ['read'], email: u.email });
    expect((await request(app).get('/api/tokens/current').set('Authorization', u.auth)).status).toBe(400);
  });

  it('rejects revoked and made up tokens', async () => {
    const u = await newUser();
    const created = await request(app).post('/api/tokens').set('Authorization', u.auth).send({ name: 'old', scopes: ['read'] });
    await request(app).delete(`/api/tokens/${created.body.id}`).set('Authorization', u.auth);
    expect((await request(app).get('/api/snippets').set('Authorization', `Bearer ${created.body.token}`)).status).toBe(401);
    expect((await request(app).get('/api/snippets').set('Authorization', 'Bearer sv_nope')).status).toBe(401);
  });
});
