import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';
import db from '../src/db.ts';

describe('sensitive snippets', () => {
  const SEALED = JSON.stringify({ scheme: 'sealed', v: 1 });

  it('refuses a sensitive snippet that was not encrypted', async () => {
    const u = await newUser();
    const res = await request(app).post('/api/snippets').set('Authorization', u.auth)
      .send({ title: 'secret', code: 'plain password', language: 'text', encryption_mode: 'sensitive' });
    expect(res.status).toBe(400);
  });

  it('stores the ciphertext and wrapped_key as sent', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { encryption_mode: 'sensitive', code: 'Q2lwaGVy', wrapped_key: SEALED });
    expect(s.code).toBe('Q2lwaGVy');
    expect(s.wrapped_key).toBe(SEALED);
  });

  it('needs wrapped_key when sensitive code is changed', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { encryption_mode: 'sensitive', code: 'Y2lwaGVy', wrapped_key: SEALED });
    const plain = await request(app).put(`/api/snippets/${s.id}`).set('Authorization', u.auth).send({ code: 'oops plain' });
    expect(plain.status).toBe(400);
    const ok = await request(app).put(`/api/snippets/${s.id}`).set('Authorization', u.auth).send({ code: 'bmV3', wrapped_key: SEALED });
    expect(ok.body.code).toBe('bmV3');
    const rename = await request(app).put(`/api/snippets/${s.id}`).set('Authorization', u.auth).send({ title: 'renamed' });
    expect(rename.body.code).toBe('bmV3');
    expect(rename.body.wrapped_key).toBe(SEALED);
  });

  it('old plain sensitive snippet gets encrypted on save', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { encryption_mode: 'sensitive', code: 'x', wrapped_key: SEALED });
    db.prepare('UPDATE snippets SET code = ?, wrapped_key = NULL WHERE id = ?').run('legacy plain', s.id);
    const res = await request(app).put(`/api/snippets/${s.id}`).set('Authorization', u.auth).send({ code: 'c2VhbGVk', wrapped_key: SEALED });
    expect(res.body.code).toBe('c2VhbGVk');
    expect(res.body.wrapped_key).toBe(SEALED);
  });

  it('standard snippets never keep a wrapped_key', async () => {
    const u = await newUser();
    const s = await newSnippet(u, { wrapped_key: SEALED });
    expect(s.wrapped_key).toBeNull();
  });
});
