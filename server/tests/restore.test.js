import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/makeTestApp.js';

async function loggedInAgent(app, email = 'a@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'long-enough-pass' });
  return agent;
}

describe('відновлення вузлів (основа undo/redo)', () => {
  let app, agent, mapId, rootId, a, b, a1;
  const nodes = (id = mapId) => agent.get(`/api/maps/${id}`).then((r) => r.body.map.nodes);
  const add = async (parentId, text) => (await agent.post(`/api/maps/${mapId}/nodes`).send({ parentId, text })).body.node;
  const restore = (body, id = mapId, who = agent) => who.post(`/api/maps/${id}/nodes/restore`).send(body);

  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
    const { body } = await agent.post('/api/maps').send({ title: 'Карта' });
    mapId = body.map.id;
    rootId = body.map.nodes[0].id;
    a = await add(rootId, 'A');
    b = await add(rootId, 'B');
    a1 = await add(a.id, 'A1');
  });

  it('видалена гілка повертається з тими самими id, властивостями і на своєму місці', async () => {
    await agent.patch(`/api/maps/${mapId}/nodes/${a1.id}`).send({ category: 'task', priority: 'high' });
    const before = await nodes();
    const snapshot = before.filter((n) => n.id === a.id || n.id === a1.id)
      .map(({ id, parentId, text, collapsed, style, category, priority, order }) => ({ id, parentId, text, collapsed, style, category, priority, order }));

    await agent.delete(`/api/maps/${mapId}/nodes/${a.id}`).expect(200);
    expect((await nodes()).map((n) => n.id)).not.toContain(a.id);

    const res = await restore({ nodes: snapshot });
    expect(res.status).toBe(201);
    const after = await nodes();
    expect(after.find((n) => n.id === a.id)).toMatchObject({ text: 'A', parentId: rootId, order: 0 });
    expect(after.find((n) => n.id === a1.id)).toMatchObject({ parentId: a.id, category: 'task', priority: 'high' });
    // B вернулся на второе место: порядок исходный
    expect(after.filter((n) => n.parentId === rootId).sort((x, y) => x.order - y.order).map((n) => n.text)).toEqual(['A', 'B']);
  });

  it('відновлена гілка вставляється на вказану позицію і зсуває сусідів', async () => {
    const res = await restore({ nodes: [{ id: 'restored-1', parentId: rootId, text: 'Між', order: 1 }] });
    expect(res.body.nodes[0]).toMatchObject({ id: 'restored-1', order: 1 });
    const list = (await nodes()).filter((n) => n.parentId === rootId).sort((x, y) => x.order - y.order);
    expect(list.map((n) => n.text)).toEqual(['A', 'Між', 'B']);
  });

  it('відхиляє зайняті id, неіснуючого батька і неправильний порядок рядків (400)', async () => {
    await restore({ nodes: [{ id: a.id, parentId: rootId, text: 'X', order: 0 }] }).expect(400);
    await restore({ nodes: [{ id: 'n1', parentId: 'немає', text: 'X', order: 0 }] }).expect(400);
    await restore({ nodes: [
      { id: 'child', parentId: 'parent', text: 'дитина раніше', order: 0 },
      { id: 'parent', parentId: rootId, text: 'батько', order: 0 },
    ] }).expect(400);
    await restore({ nodes: [{ id: 'dup', parentId: rootId, text: 'a', order: 0 }, { id: 'dup', parentId: rootId, text: 'b', order: 1 }] }).expect(400);
    await restore({ nodes: [] }).expect(400);
  });

  it('чужа карта недоступна (404), неавторизований отримує 401', async () => {
    const intruder = await loggedInAgent(app, 'intruder@example.com');
    await restore({ nodes: [{ id: 'x1', parentId: rootId, text: 'X', order: 0 }] }, mapId, intruder).expect(404);
    await request(app).post(`/api/maps/${mapId}/nodes/restore`).send({ nodes: [] }).expect(401);
  });
});
