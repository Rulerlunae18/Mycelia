import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/makeTestApp.js';

const creds = { email: 'Ruler@Example.com', password: 'correct-horse-battery' };

describe('авторизація', () => {
  let app;
  beforeEach(() => {
    app = makeTestApp();
  });

  it('реєструє користувача, нормалізує email і не віддає хеш пароля', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ruler@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=.*HttpOnly/);
  });

  it('відхиляє дублікат email (409)', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
  });

  it('відхиляє короткий пароль і некоректний email (400)', async () => {
    const short = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.co', password: '123' });
    expect(short.status).toBe(400);
    const bad = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'long-enough-pass' });
    expect(bad.status).toBe(400);
  });

  it('вхід з правильним паролем працює, з неправильним дає 401', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const ok = await request(app).post('/api/auth/login').send(creds);
    expect(ok.status).toBe(200);
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ ...creds, password: 'wrong-password-1' });
    expect(wrong.status).toBe(401);
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password-1' });
    expect(unknown.status).toBe(401);
    // однакове повідомлення, щоб не розкривати, чи існує email
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it('/me повертає користувача за cookie і дає 401 без токена', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(creds);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ruler@example.com');

    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(401);
  });

  it('приймає токен у заголовку Bearer і відхиляє підроблений', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    const token = reg.headers['set-cookie'][0].match(/token=([^;]+)/)[1];
    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    const fake = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(fake.status).toBe(401);
  });

  it('вихід очищає cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(creds);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
});
