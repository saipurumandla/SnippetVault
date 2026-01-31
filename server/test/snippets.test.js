import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';

describe('snippets', () => {
  it('creates and reads a snippet', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { description: 'wait before calling' });
    expect(s.id).toBeTruthy();
    expect(s.tags).toEqual([]);
    expect(s.visibility).toBe('private');

    const res = await request(app).get(`/api/snippets/${s.id}`).set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Debounce helper');
  });

  it('validates input', async () => {
    const u = await newUser();
    const res = await request(app).post('/api/snippets').set('Authorization', u.auth).send({ title: '', code: 'x', language: 'js' });
    expect(res.status).toBe(400);
    const bad = await request(app).post('/api/snippets').set('Authorization', u.auth)
      .send({ title: 't', code: 'x', language: 'js', visibility: 'everyone' });
    expect(bad.status).toBe(400);
  });

  it('lists only own and shared snippets', async () => {
    const a = await newUser();
    const b = await newUser();
    await newSnippet(a, { title: 'a private' });
    await newSnippet(a, { title: 'a shared', visibility: 'shared' });
    await newSnippet(b, { title: 'b private' });

    const res = await request(app).get('/api/snippets').set('Authorization', b.auth);
    const titles = res.body.map(s => s.title);
    expect(titles).toContain('a shared');
    expect(titles).toContain('b private');
    expect(titles).not.toContain('a private');
  });

  it('forbids reading someone else private snippet', async () => {
    const a = await newUser();
    const b = await newUser();
    const s = await newSnippet(a);
    const res = await request(app).get(`/api/snippets/${s.id}`).set('Authorization', b.auth);
    expect(res.status).toBe(403);
  });

  it('searches with full text', async () => {
    const u = await newUser();
    await newSnippet(u, { title: 'Parse csv file', code: 'import csv' , language: 'python' });
    await newSnippet(u, { title: 'Retry fetch', code: 'await fetch(url)' });
    const res = await request(app).get('/api/snippets?q=csv').set('Authorization', u.auth);
    expect(res.body.map(s => s.title)).toEqual(['Parse csv file']);
    const none = await request(app).get('/api/snippets?q=zzzz').set('Authorization', u.auth);
    expect(none.body).toEqual([]);
  });

  it('filters by language', async () => {
    const u = await newUser();
    await newSnippet(u, { language: 'go' });
    await newSnippet(u, { language: 'rust' });
    const res = await request(app).get('/api/snippets?language=go').set('Authorization', u.auth);
    expect(res.body.every(s => s.language === 'go')).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('updates and keeps old code as a version', async () => {
    const u = await newUser();
    const s = await newSnippet(u);
    const res = await request(app).put(`/api/snippets/${s.id}`).set('Authorization', u.auth).send({ code: 'const x = 2' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('const x = 2');
    expect(res.body.title).toBe(s.title);
  });

  it('only the author can update or delete', async () => {
    const a = await newUser();
    const b = await newUser();
    const s = await newSnippet(a, { visibility: 'shared' });
    expect((await request(app).put(`/api/snippets/${s.id}`).set('Authorization', b.auth).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/snippets/${s.id}`).set('Authorization', b.auth)).status).toBe(404);
  });

  it('deletes a snippet', async () => {
    const u = await newUser();
    const s = await newSnippet(u);
    expect((await request(app).delete(`/api/snippets/${s.id}`).set('Authorization', u.auth)).status).toBe(204);
    expect((await request(app).get(`/api/snippets/${s.id}`).set('Authorization', u.auth)).status).toBe(404);
  });

  it('counts copies', async () => {
    const u = await newUser();
    const s = await newSnippet(u);
    await request(app).post(`/api/snippets/${s.id}/copy`).set('Authorization', u.auth);
    await request(app).post(`/api/snippets/${s.id}/copy`).set('Authorization', u.auth);
    const res = await request(app).get(`/api/snippets/${s.id}`).set('Authorization', u.auth);
    expect(res.body.copy_count).toBe(2);
  });

  it('hides expired snippets from the list', async () => {
    const u = await newUser();
    const old = await newSnippet(u, { title: 'old one', encryption_mode: 'sensitive' });
    await newSnippet(u, { title: 'still good' });
    await request(app).post(`/api/share/${old.id}`).set('Authorization', u.auth)
      .send({ recipients: [u.id], payload: { ciphertext: 'c', nonce: 'n' }, expires_at: '2020-01-01T00:00:00Z' });
    const res = await request(app).get('/api/snippets').set('Authorization', u.auth);
    const mine = res.body.filter(s => s.author_id === u.id).map(s => s.title);
    expect(mine).toEqual(['still good']);
  });
});
