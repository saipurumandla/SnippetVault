import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';

const SEALED = JSON.stringify({ scheme: 'sealed', v: 1 });

const payload = { ciphertext: 'Y2lwaGVy', nonce: 'bm9uY2U=' };

describe('share', () => {
  it('shares a sensitive snippet and logs it', async () => {
    const u = await newUser();
    const other = await newUser();
    const s = await newSnippet(u, { encryption_mode: 'sensitive', code: 'b64ciphertext', wrapped_key: SEALED });
    const res = await request(app).post(`/api/share/${s.id}`).set('Authorization', u.auth)
      .send({ recipients: [other.id], payload });
    expect(res.body).toEqual({ ok: true });

    const events = await request(app).get('/api/security/events').set('Authorization', u.auth);
    expect(events.body[0].event_type).toBe('share');
    expect(JSON.parse(events.body[0].meta)).toEqual({ recipientCount: 1 });
  });

  it('refuses to share standard snippets', async () => {
    const u = await newUser();
    const s = await newSnippet(u);
    const res = await request(app).post(`/api/share/${s.id}`).set('Authorization', u.auth).send({ recipients: [1], payload });
    expect(res.status).toBe(400);
  });

  it('needs at least one recipient', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { encryption_mode: 'sensitive', wrapped_key: SEALED });
    const res = await request(app).post(`/api/share/${s.id}`).set('Authorization', u.auth).send({ recipients: [], payload });
    expect(res.status).toBe(400);
  });

  it('lists recipients with keys in a project', async () => {
    const owner = await newUser();
    const member = await newUser();
    const p = (await request(app).post('/api/projects').set('Authorization', owner.auth).send({ name: 'Keys' })).body;
    await request(app).post(`/api/projects/${p.id}/members`).set('Authorization', owner.auth).send({ userId: member.id });

    expect((await request(app).get(`/api/share/recipients/${p.id}`).set('Authorization', owner.auth)).body).toEqual([]);
    await request(app).post('/api/auth/enc-pubkey').set('Authorization', member.auth).send({ encPublicKey: 'pk' });
    const res = await request(app).get(`/api/share/recipients/${p.id}`).set('Authorization', owner.auth);
    expect(res.body.map(r => r.id)).toEqual([member.id]);
  });
});

describe('expired', () => {
  it('lists and deletes expired snippets', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { title: 'gone', encryption_mode: 'sensitive', wrapped_key: SEALED });
    const later = await newSnippet(u, { title: 'later', encryption_mode: 'sensitive', wrapped_key: SEALED });
    // expiry only can be set by share right now
    await request(app).post(`/api/share/${s.id}`).set('Authorization', u.auth)
      .send({ recipients: [u.id], payload, expires_at: '2021-05-01T00:00:00Z' });
    await request(app).post(`/api/share/${later.id}`).set('Authorization', u.auth)
      .send({ recipients: [u.id], payload, expires_at: '2099-01-01T00:00:00Z' });

    const res = await request(app).get('/api/expired').set('Authorization', u.auth);
    expect(res.body.map(x => x.title)).toEqual(['gone']);
    expect(res.body[0].expired_at).toBeTruthy();

    expect((await request(app).delete(`/api/expired/${s.id}`).set('Authorization', u.auth)).status).toBe(204);
    expect((await request(app).get('/api/expired').set('Authorization', u.auth)).body).toEqual([]);
  });
});
