import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';

describe('tags', () => {
  it('adds, lists and removes tags', async () => {
    const u = await newUser();
    const s = await newSnippet(u);
    expect((await request(app).post(`/api/tags/${s.id}`).set('Authorization', u.auth).send({ tag: ' React ' })).status).toBe(201);
    await request(app).post(`/api/tags/${s.id}`).set('Authorization', u.auth).send({ tag: 'hooks' });

    expect((await request(app).get('/api/tags').set('Authorization', u.auth)).body).toEqual(['hooks', 'react']);
    const snip = await request(app).get(`/api/snippets/${s.id}`).set('Authorization', u.auth);
    expect(snip.body.tags.sort()).toEqual(['hooks', 'react']);

    expect((await request(app).delete(`/api/tags/${s.id}/hooks`).set('Authorization', u.auth)).status).toBe(204);
    expect((await request(app).get('/api/tags').set('Authorization', u.auth)).body).toEqual(['react']);
  });

  it('rejects empty tag and other user snippet', async () => {
    const a = await newUser();
    const b = await newUser();
    const s = await newSnippet(a);
    expect((await request(app).post(`/api/tags/${s.id}`).set('Authorization', a.auth).send({ tag: '  ' })).status).toBe(400);
    expect((await request(app).post(`/api/tags/${s.id}`).set('Authorization', b.auth).send({ tag: 'x' })).status).toBe(404);
  });
});

describe('projects', () => {
  it('creates a project and lists it for the owner', async () => {
    const u = await newUser();
    const res = await request(app).post('/api/projects').set('Authorization', u.auth).send({ name: '  Payments  ' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Payments');
    const list = await request(app).get('/api/projects').set('Authorization', u.auth);
    expect(list.body.map(p => p.name)).toEqual(['Payments']);
  });

  it('validates the name', async () => {
    const u = await newUser();
    expect((await request(app).post('/api/projects').set('Authorization', u.auth).send({ name: '' })).status).toBe(400);
  });

  it('members can see project snippets, others cannot', async () => {
    const owner = await newUser();
    const member = await newUser();
    const outsider = await newUser();
    const p = (await request(app).post('/api/projects').set('Authorization', owner.auth).send({ name: 'Team' })).body;

    expect((await request(app).post(`/api/projects/${p.id}/members`).set('Authorization', owner.auth).send({ userId: member.id })).status).toBe(201);
    expect((await request(app).post(`/api/projects/${p.id}/members`).set('Authorization', member.auth).send({ userId: outsider.id })).status).toBe(404);

    const s = await newSnippet(owner, { title: 'team snippet', visibility: 'project', project_id: p.id });
    expect((await request(app).get(`/api/snippets/${s.id}`).set('Authorization', member.auth)).status).toBe(200);
    expect((await request(app).get(`/api/snippets/${s.id}`).set('Authorization', outsider.auth)).status).toBe(403);

    const members = await request(app).get(`/api/projects/${p.id}/members`).set('Authorization', member.auth);
    expect(members.body.map(m => m.id).sort()).toEqual([owner.id, member.id].sort());
    expect((await request(app).get(`/api/projects/${p.id}/members`).set('Authorization', outsider.auth)).status).toBe(403);
  });
});
