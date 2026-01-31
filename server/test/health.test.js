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
