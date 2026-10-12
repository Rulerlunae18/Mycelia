import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/makeTestApp.js';

async function loggedInAgent(app, email = 'a@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'long-enough-pass' });
  return agent;
}

const nodesUrl = (mapId) => `/api/maps/${mapId}/nodes`;
const url = (mapId, id = '') => `/api/maps/${mapId}/boundaries${id ? `/${id}` : ''}`;

describe('області', () => {
  let app, agent, mapId, rootId, a, b;
  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
    const { body } = await agent.post('/api/maps').send({ title: 'Карта' });
    mapId = body.map.id;
    rootId = body.map.nodes[0].id;
    a = (await agent.post(nodesUrl(mapId)).send({ parentId: rootId, text: 'A' })).body.node;
    b = (await agent.post(nodesUrl(mapId)).send({ parentId: rootId, text: 'B' })).body.node;
  });

  it('усі маршрути вимагають авторизації', async () => {
    await request(app).post(url(mapId)).send({ nodeIds: [a.id] }).expect(401);
  });

  it('створює область, прибирає дублікати вузлів і віддає її разом із картою', async () => {
    const res = await agent.post(url(mapId)).send({ label: 'Фаза 1', nodeIds: [a.id, b.id, a.id] });
    expect(res.status).toBe(201);
    expect(res.body.boundary).toMatchObject({ label: 'Фаза 1', nodeIds: [a.id, b.id] });
    const map = await agent.get(`/api/maps/${mapId}`);
    expect(map.body.map.boundaries).toHaveLength(1);
  });

  it('відхиляє порожній набір, чужі вузли й неіснуючі id (400)', async () => {
    await agent.post(url(mapId)).send({ nodeIds: [] }).expect(400);
    await agent.post(url(mapId)).send({ nodeIds: ['немає'] }).expect(400);
    const other = (await agent.post('/api/maps').send({ title: 'Інша' })).body.map;
    await agent.post(url(mapId)).send({ nodeIds: [other.nodes[0].id] }).expect(400);
  });

  it('змінює назву й склад, видаляє область', async () => {
    const { body } = await agent.post(url(mapId)).send({ nodeIds: [a.id] });
    const id = body.boundary.id;
    const patched = await agent.patch(url(mapId, id)).send({ label: 'Нова', nodeIds: [b.id] });
    expect(patched.body.boundary).toMatchObject({ label: 'Нова', nodeIds: [b.id] });
    await agent.patch(url(mapId, id)).send({}).expect(400);
    await agent.delete(url(mapId, id)).expect(204);
    await agent.patch(url(mapId, id)).send({ label: 'x' }).expect(404);
  });

  it('чужа карта і чужа область недоступні (404)', async () => {
    const { body } = await agent.post(url(mapId)).send({ nodeIds: [a.id] });
    const intruder = await loggedInAgent(app, 'intruder@example.com');
    await intruder.post(url(mapId)).send({ nodeIds: [a.id] }).expect(404);
    await intruder.patch(url(mapId, body.boundary.id)).send({ label: 'x' }).expect(404);
    await intruder.delete(url(mapId, body.boundary.id)).expect(404);
  });

  it('область не можна змінити через URL іншої власної карти', async () => {
    const { body } = await agent.post(url(mapId)).send({ nodeIds: [a.id] });
    const other = (await agent.post('/api/maps').send({ title: 'Інша' })).body.map;
    await agent.patch(url(other.id, body.boundary.id)).send({ label: 'x' }).expect(404);
  });

  it('видалення вузла прибирає його з областей, а порожня область зникає', async () => {
    const one = (await agent.post(url(mapId)).send({ nodeIds: [a.id, b.id] })).body.boundary;
    const solo = (await agent.post(url(mapId)).send({ nodeIds: [a.id] })).body.boundary;
    await agent.delete(`${nodesUrl(mapId)}/${a.id}`).expect(200);
    const { boundaries } = (await agent.get(`/api/maps/${mapId}`)).body.map;
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0]).toMatchObject({ id: one.id, nodeIds: [b.id] });
    expect(boundaries.find((x) => x.id === solo.id)).toBeUndefined();
  });

  it('не більше 50 областей на карті', async () => {
    for (let i = 0; i < 50; i++) await agent.post(url(mapId)).send({ nodeIds: [a.id] }).expect(201);
    await agent.post(url(mapId)).send({ nodeIds: [a.id] }).expect(400);
  });
});
