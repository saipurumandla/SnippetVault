import { describe, it, expect } from 'vitest';
import { app, request, newUser } from './helpers.js';
import { createDraft } from '../src/drafts.ts';

const proposal = { title: 'Sleep helper', code: 'const sleep = ms => new Promise(r => setTimeout(r, ms));', language: 'javascript', description: 'wait a bit', tags: ['async'] };

describe('drafts review', () => {
  it('lists pending drafts and flags possible secrets', async () => {
    const u = await newUser();
    createDraft(u.id, null, 'cursor', proposal);
    createDraft(u.id, null, 'cursor', { ...proposal, title: 'Leaky', code: 'const key = "sk-abcdefghijklmnopqrstuvwxyz123456"' });
    const res = await request(app).get('/api/drafts').set('Authorization', u.auth);
    expect(res.body.map(d => [d.title, d.possible_secret])).toEqual([['Leaky', true], ['Sleep helper', false]]);
    expect(res.body[1]).toMatchObject({ source: 'cursor', tags: ['async'], status: 'pending' });
  });

  it('accept creates a private standard snippet with tags', async () => {
    const u = await newUser();
    const d = createDraft(u.id, null, 'cursor', proposal);
    const res = await request(app).post(`/api/drafts/${d.id}/accept`).set('Authorization', u.auth).send({});
    expect(res.status).toBe(201);
    const snip = await request(app).get(`/api/snippets/${res.body.snippet_id}`).set('Authorization', u.auth);
    expect(snip.body).toMatchObject({ title: 'Sleep helper', visibility: 'private', encryption_mode: 'standard', tags: ['async'], description: 'wait a bit' });
    expect((await request(app).get('/api/drafts').set('Authorization', u.auth)).body).toEqual([]);
    const accepted = await request(app).get('/api/drafts?status=accepted').set('Authorization', u.auth);
    expect(accepted.body[0].snippet_id).toBe(res.body.snippet_id);
    expect((await request(app).post(`/api/drafts/${d.id}/accept`).set('Authorization', u.auth).send({})).status).toBe(404);
  });

  it('accept after editing links the snippet made in the editor', async () => {
    const u = await newUser();
    const d = createDraft(u.id, null, 'cursor', proposal);
    const edited = await request(app).post('/api/snippets').set('Authorization', u.auth).send({ title: 'Edited', code: 'x', language: 'javascript' });
    const res = await request(app).post(`/api/drafts/${d.id}/accept`).set('Authorization', u.auth).send({ snippet_id: edited.body.id });
    expect(res.body).toEqual({ snippet_id: edited.body.id });
  });

  it('reject, and other users cannot touch your drafts', async () => {
    const a = await newUser();
    const b = await newUser();
    const d = createDraft(a.id, null, 'cursor', proposal);
    expect((await request(app).post(`/api/drafts/${d.id}/reject`).set('Authorization', b.auth)).status).toBe(404);
    expect((await request(app).post(`/api/drafts/${d.id}/accept`).set('Authorization', b.auth).send({})).status).toBe(404);
    const bSnippet = await request(app).post('/api/snippets').set('Authorization', b.auth).send({ title: 'b', code: 'x', language: 'js' });
    expect((await request(app).post(`/api/drafts/${d.id}/accept`).set('Authorization', a.auth).send({ snippet_id: bSnippet.body.id })).status).toBe(404);
    expect((await request(app).post(`/api/drafts/${d.id}/reject`).set('Authorization', a.auth)).status).toBe(204);
    expect((await request(app).get('/api/drafts?status=rejected').set('Authorization', a.auth)).body).toHaveLength(1);
  });
});
