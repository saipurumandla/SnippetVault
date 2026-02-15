import { describe, it, expect } from 'vitest';
import { app, request } from './helpers.js';

describe('health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('ready checks the db', async () => {
    const res = await request(app).get('/ready');
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('ping works without auth', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.body).toEqual({ ok: true });
  });
});

describe('errors', () => {
  it('unknown api route gives json 404', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('broken json body gives 400 not 500', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });
});
