import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/makeTestApp.js';

async function loggedInAgent(app, email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'long-enough-pass' });
  return agent;
}

describe('карти', () => {
  let app;
  beforeEach(() => {
    app = makeTestApp();
  });

  it('усі маршрути вимагають авторизації', async () => {
    await request(app).get('/api/maps').expect(401);
    await request(app).post('/api/maps').send({ title: 'x' }).expect(401);
  });

  it('створює карту з кореневим вузлом і показує її у списку', async () => {
    const agent = await loggedInAgent(app, 'a@example.com');
    const created = await agent.post('/api/maps').send({ title: 'Мій проєкт' });
    expect(created.status).toBe(201);
    expect(created.body.map.nodes).toHaveLength(1);
    expect(created.body.map.nodes[0].parentId).toBeNull();
    expect(created.body.map.nodes[0].text).toBe('Мій проєкт');

    const list = await agent.get('/api/maps');
    expect(list.body.maps).toHaveLength(1);
    expect(list.body.maps[0].nodes).toBeUndefined();
  });

  it('перевіряє дані: порожня назва і невідома розкладка дають 400', async () => {
    const agent = await loggedInAgent(app, 'a@example.com');
    await agent.post('/api/maps').send({ title: '   ' }).expect(400);
    await agent.post('/api/maps').send({ title: 'ok', layout: 'spiral' }).expect(400);
  });

  it('оновлює і видаляє власну карту', async () => {
    const agent = await loggedInAgent(app, 'a@example.com');
    const { body } = await agent.post('/api/maps').send({ title: 'Стара' });
    const id = body.map.id;

    const patched = await agent.patch(`/api/maps/${id}`).send({ title: 'Нова', layout: 'tree' });
    expect(patched.status).toBe(200);
    expect(patched.body.map.title).toBe('Нова');
    expect(patched.body.map.layout).toBe('tree');

    await agent.delete(`/api/maps/${id}`).expect(204);
    await agent.get(`/api/maps/${id}`).expect(404);
  });

  it('чужа карта недоступна: 404 для читання, зміни і видалення', async () => {
    const owner = await loggedInAgent(app, 'owner@example.com');
    const intruder = await loggedInAgent(app, 'intruder@example.com');
    const { body } = await owner.post('/api/maps').send({ title: 'Секрет' });
    const id = body.map.id;

    await intruder.get(`/api/maps/${id}`).expect(404);
    await intruder.patch(`/api/maps/${id}`).send({ title: 'Зламано' }).expect(404);
    await intruder.delete(`/api/maps/${id}`).expect(404);
    // власник нічого не втратив
    const still = await owner.get(`/api/maps/${id}`);
    expect(still.body.map.title).toBe('Секрет');
  });
});
