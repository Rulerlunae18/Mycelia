import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/makeTestApp.js';

async function loggedInAgent(app, email = 'a@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'long-enough-pass' });
  return agent;
}

async function newMap(agent, title = 'Карта') {
  const { body } = await agent.post('/api/maps').send({ title });
  return { mapId: body.map.id, rootId: body.map.nodes[0].id };
}

const base = (mapId) => `/api/maps/${mapId}/nodes`;

async function addNode(agent, mapId, parentId, text, index) {
  const res = await agent.post(base(mapId)).send({ parentId, text, index });
  expect(res.status).toBe(201);
  return res.body.node;
}

// Дерево карти як { id: { parentId, order, text } }
async function fetchTree(agent, mapId) {
  const { body } = await agent.get(`/api/maps/${mapId}`);
  return body.map.nodes;
}

const childTexts = (nodes, parentId) =>
  nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map((n) => n.text);

describe('вузли: створення', () => {
  let app, agent, mapId, rootId;
  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
    ({ mapId, rootId } = await newMap(agent));
  });

  it('додає дітей у кінець і зберігає порядок', async () => {
    await addNode(agent, mapId, rootId, 'A');
    await addNode(agent, mapId, rootId, 'B');
    const nodes = await fetchTree(agent, mapId);
    expect(childTexts(nodes, rootId)).toEqual(['A', 'B']);
  });

  it('вставка за індексом зсуває сусідів', async () => {
    await addNode(agent, mapId, rootId, 'A');
    await addNode(agent, mapId, rootId, 'C');
    const b = await addNode(agent, mapId, rootId, 'B', 1);
    expect(b.order).toBe(1);
    const nodes = await fetchTree(agent, mapId);
    expect(childTexts(nodes, rootId)).toEqual(['A', 'B', 'C']);
    // order без дублікатів
    const orders = nodes.filter((n) => n.parentId === rootId).map((n) => n.order);
    expect(new Set(orders).size).toBe(3);
  });

  it('індекс більший за кількість дітей ставить у кінець', async () => {
    await addNode(agent, mapId, rootId, 'A');
    const b = await addNode(agent, mapId, rootId, 'B', 99);
    expect(b.order).toBe(1);
  });

  it('відхиляє неіснуючого батька (404) і некоректні дані (400)', async () => {
    await agent.post(base(mapId)).send({ parentId: 'nope', text: 'x' }).expect(404);
    await agent.post(base(mapId)).send({ text: 'без батька' }).expect(400);
    await agent.post(base(mapId)).send({ parentId: rootId, text: 'x'.repeat(2001) }).expect(400);
    await agent.post(base(mapId)).send({ parentId: rootId, index: -1 }).expect(400);
  });

  it('не дозволяє призначити батьком вузол з іншої карти', async () => {
    const other = await newMap(agent, 'Інша');
    await agent.post(base(mapId)).send({ parentId: other.rootId, text: 'x' }).expect(404);
  });
});

describe('вузли: зміна', () => {
  let app, agent, mapId, rootId;
  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
    ({ mapId, rootId } = await newMap(agent));
  });

  it('змінює текст, згортання, стиль, категорію і терміновість', async () => {
    const n = await addNode(agent, mapId, rootId, 'Стара');
    const res = await agent.patch(`${base(mapId)}/${n.id}`).send({
      text: 'Нова',
      collapsed: true,
      style: { color: '#7ee0a4', shape: 'pill' },
      category: 'idea',
      priority: 'urgent',
    });
    expect(res.status).toBe(200);
    expect(res.body.node).toMatchObject({
      text: 'Нова',
      collapsed: true,
      category: 'idea',
      priority: 'urgent',
    });
  });

  it('дозволяє зняти категорію і терміновість (null)', async () => {
    const n = await addNode(agent, mapId, rootId, 'X');
    await agent.patch(`${base(mapId)}/${n.id}`).send({ category: 'idea', priority: 'high' });
    const res = await agent.patch(`${base(mapId)}/${n.id}`).send({ category: null, priority: null });
    expect(res.body.node.category).toBeNull();
    expect(res.body.node.priority).toBeNull();
  });

  it('відхиляє невідому терміновість і порожнє оновлення (400)', async () => {
    const n = await addNode(agent, mapId, rootId, 'X');
    await agent.patch(`${base(mapId)}/${n.id}`).send({ priority: 'asap' }).expect(400);
    await agent.patch(`${base(mapId)}/${n.id}`).send({}).expect(400);
  });

  it('неіснуючий вузол дає 404', async () => {
    await agent.patch(`${base(mapId)}/nope`).send({ text: 'x' }).expect(404);
  });
});

describe('вузли: переміщення', () => {
  let app, agent, mapId, rootId, a, b, a1;
  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
    ({ mapId, rootId } = await newMap(agent));
    a = await addNode(agent, mapId, rootId, 'A');
    b = await addNode(agent, mapId, rootId, 'B');
    a1 = await addNode(agent, mapId, a.id, 'A1');
  });

  it('переносить вузол до іншого батька, піддерево їде разом', async () => {
    const res = await agent.post(`${base(mapId)}/${a.id}/move`).send({ parentId: b.id });
    expect(res.status).toBe(200);
    const nodes = await fetchTree(agent, mapId);
    expect(childTexts(nodes, rootId)).toEqual(['B']);
    expect(childTexts(nodes, b.id)).toEqual(['A']);
    expect(childTexts(nodes, a.id)).toEqual(['A1']);
  });

  it('змінює порядок серед сусідів', async () => {
    await agent.post(`${base(mapId)}/${b.id}/move`).send({ parentId: rootId, index: 0 }).expect(200);
    const nodes = await fetchTree(agent, mapId);
    expect(childTexts(nodes, rootId)).toEqual(['B', 'A']);
  });

  it('повертає зміни позицій для синхронізації клієнта', async () => {
    const res = await agent.post(`${base(mapId)}/${a1.id}/move`).send({ parentId: b.id });
    const moved = res.body.changes.find((c) => c.id === a1.id);
    expect(moved).toEqual({ id: a1.id, parentId: b.id, order: 0 });
  });

  it('забороняє переміщення в себе, у нащадка і переміщення кореня', async () => {
    await agent.post(`${base(mapId)}/${a.id}/move`).send({ parentId: a.id }).expect(400);
    await agent.post(`${base(mapId)}/${a.id}/move`).send({ parentId: a1.id }).expect(400);
    await agent.post(`${base(mapId)}/${rootId}/move`).send({ parentId: a.id }).expect(400);
  });

  it('відхиляє неіснуючого нового батька (404)', async () => {
    await agent.post(`${base(mapId)}/${a.id}/move`).send({ parentId: 'nope' }).expect(404);
  });
});

describe('вузли: видалення', () => {
  let app, agent, mapId, rootId;
  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
    ({ mapId, rootId } = await newMap(agent));
  });

  it('видаляє вузол разом з піддеревом і впорядковує сусідів', async () => {
    const a = await addNode(agent, mapId, rootId, 'A');
    await addNode(agent, mapId, rootId, 'B');
    await addNode(agent, mapId, rootId, 'C');
    const a1 = await addNode(agent, mapId, a.id, 'A1');
    const a11 = await addNode(agent, mapId, a1.id, 'A11');

    const res = await agent.delete(`${base(mapId)}/${a.id}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted.sort()).toEqual([a.id, a1.id, a11.id].sort());

    const nodes = await fetchTree(agent, mapId);
    expect(nodes.map((n) => n.text).sort()).toEqual(['B', 'C', 'Карта']);
    expect(nodes.filter((n) => n.parentId === rootId).map((n) => n.order).sort()).toEqual([0, 1]);
  });

  it('корінь видалити не можна (400)', async () => {
    await agent.delete(`${base(mapId)}/${rootId}`).expect(400);
  });

  it('неіснуючий вузол дає 404', async () => {
    await agent.delete(`${base(mapId)}/nope`).expect(404);
  });
});

describe('вузли: доступ', () => {
  it('усі маршрути вимагають входу', async () => {
    const app = makeTestApp();
    await request(app).post('/api/maps/x/nodes').send({ parentId: 'y' }).expect(401);
    await request(app).delete('/api/maps/x/nodes/y').expect(401);
  });

  it('чужа карта: 404 на створення, зміну, переміщення і видалення', async () => {
    const app = makeTestApp();
    const owner = await loggedInAgent(app, 'owner@example.com');
    const intruder = await loggedInAgent(app, 'intruder@example.com');
    const { mapId, rootId } = await newMap(owner);
    const n = await addNode(owner, mapId, rootId, 'Секрет');

    await intruder.post(base(mapId)).send({ parentId: rootId, text: 'x' }).expect(404);
    await intruder.patch(`${base(mapId)}/${n.id}`).send({ text: 'Зламано' }).expect(404);
    await intruder.post(`${base(mapId)}/${n.id}/move`).send({ parentId: rootId }).expect(404);
    await intruder.delete(`${base(mapId)}/${n.id}`).expect(404);

    const nodes = await fetchTree(owner, mapId);
    expect(childTexts(nodes, rootId)).toEqual(['Секрет']);
  });
});
