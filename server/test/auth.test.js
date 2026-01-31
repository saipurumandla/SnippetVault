import { describe, it, expect } from 'vitest';
import { app, request, newUser } from './helpers.js';

describe('auth', () => {
  it('registers and logs in', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email: 'a@example.com', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();

    const login = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects bad email and short password', async () => {
    const bad = await request(app).post('/api/auth/register').send({ email: 'nope', password: 'password123' });
    expect(bad.status).toBe(400);
    const short = await request(app).post('/api/auth/register').send({ email: 'b@example.com', password: 'short' });
    expect(short.status).toBe(400);
    expect(typeof short.body.error).toBe('string');
  });

  it('rejects wrong password', async () => {
    await request(app).post('/api/auth/register').send({ email: 'c@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'c@example.com', password: 'wrongpass1' });
    expect(res.status).toBe(401);
  });

  it('protected routes need a valid token', async () => {
    expect((await request(app).get('/api/snippets')).status).toBe(401);
    const res = await request(app).get('/api/snippets').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });

  it('lists users without password hashes', async () => {
    const u = await newUser();
    const res = await request(app).get('/api/auth/users').set('Authorization', u.auth);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].password_hash).toBeUndefined();
  });

  it('stores the encryption public key', async () => {
    const u = await newUser();
    expect((await request(app).post('/api/auth/enc-pubkey').set('Authorization', u.auth).send({})).status).toBe(400);
    const res = await request(app).post('/api/auth/enc-pubkey').set('Authorization', u.auth).send({ encPublicKey: 'pk123' });
    expect(res.body).toEqual({ ok: true });
  });
});
