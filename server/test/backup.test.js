import { describe, it, expect } from 'vitest';
import { app, request, newUser, newSnippet } from './helpers.js';

const SEALED = JSON.stringify({ scheme: 'sealed', v: 1 });

describe('backup', () => {
  it('needs a passphrase', async () => {
    const u = await newUser();
    expect((await request(app).get('/api/backup/export').set('Authorization', u.auth)).status).toBe(400);
  });

  it('exports and restores, without sensitive snippets', async () => {
    const u = await newUser();
    await newSnippet(u, { title: 'keep me' });
    await newSnippet(u, { title: 'secret', encryption_mode: 'sensitive', wrapped_key: SEALED });

    const exp = await request(app).get('/api/backup/export?passphrase=hunter22').set('Authorization', u.auth)
      .buffer(true).parse((res, cb) => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => cb(null, d)); });
    expect(exp.status).toBe(200);
    expect(exp.body).not.toContain('keep me');

    const other = await newUser();
    const res = await request(app).post('/api/backup/restore?passphrase=hunter22').set('Authorization', other.auth)
      .set('Content-Type', 'text/plain').send(exp.body);
    expect(res.body).toEqual({ imported: 1 });
    const list = await request(app).get('/api/snippets').set('Authorization', other.auth);
    expect(list.body.map(s => s.title)).toEqual(['keep me']);
  });

  it('rejects wrong passphrase', async () => {
    const u = await newUser();
    await newSnippet(u);
    const exp = await request(app).get('/api/backup/export?passphrase=right1').set('Authorization', u.auth)
      .buffer(true).parse((res, cb) => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => cb(null, d)); });
    const res = await request(app).post('/api/backup/restore?passphrase=wrong1').set('Authorization', u.auth)
      .set('Content-Type', 'text/plain').send(exp.body);
    expect(res.status).toBe(400);
  });
});
