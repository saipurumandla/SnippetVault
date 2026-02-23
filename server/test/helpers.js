import request from 'supertest';
import app from '../src/app.ts';

let n = 0;

export async function newUser() {
  n += 1;
  const email = `user${n}-${Date.now()}@example.com`;
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  const token = res.body.token;
  return { email, token, id: JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).id, auth: `Bearer ${token}` };
}

export async function newSnippet(user, fields = {}) {
  const res = await request(app)
    .post('/api/snippets')
    .set('Authorization', user.auth)
    .send({ title: 'Debounce helper', code: 'function debounce(fn, ms) {}', language: 'javascript', ...fields });
  return res.body;
}

export { app, request };
