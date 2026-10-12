import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/makeTestApp.js';

async function loggedInAgent(app, email = 'a@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'long-enough-pass' });
  return agent;
}

describe('дублювання гілки (Prototype)', () => {
  let app, agent, mapId, rootId, a, b, a1, a2;
  const url = (id) => `/api/maps/${mapId}/nodes/${id}`;
  const add = async (parentId, text) => (await agent.post(`/api/maps/${mapId}/nodes`).send({ parentId, text })).body.node;

  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
    const { body } = await agent.post('/api/maps').send({ title: 'Карта' });
    mapId = body.map.id;
    rootId = body.map.nodes[0].id;
    a = await add(rootId, 'A');
    b = await add(rootId, 'B');
    a1 = await add(a.id, 'A1');
    a2 = await add(a.id, 'A2');
    await agent.patch(url(a1.id)).send({ category: 'task', priority: 'urgent', collapsed: true });
  });

  it('копіює гілку з усіма вкладеними вузлами одразу після оригіналу', async () => {
    const res = await agent.post(`${url(a.id)}/duplicate`);
    expect(res.status).toBe(201);
    expect(res.body.nodes).toHaveLength(3);
    const copyRoot = res.body.nodes[0];
    expect(copyRoot).toMatchObject({ text: 'A (копія)', parentId: rootId });

    const { body } = await agent.get(`/api/maps/${mapId}`);
    const nodes = body.map.nodes;
    const order = nodes.filter((n) => n.parentId === rootId).sort((x, y) => x.order - y.order).map((n) => n.text);
    expect(order).toEqual(['A', 'A (копія)', 'B']);

    const kids = nodes.filter((n) => n.parentId === copyRoot.id).sort((x, y) => x.order - y.order);
    expect(kids.map((n) => n.text)).toEqual(['A1', 'A2']);
    expect(kids[0]).toMatchObject({ category: 'task', priority: 'urgent', collapsed: true });
  });

  it('копія незалежна: нові id, зміна копії не чіпає оригінал', async () => {
    const { body } = await agent.post(`${url(a.id)}/duplicate`);
    const copyIds = body.nodes.map((n) => n.id);
    expect(copyIds).not.toContain(a.id);
    expect(copyIds).not.toContain(a1.id);

    const copyChild = body.nodes.find((n) => n.text === 'A1');
    await agent.patch(url(copyChild.id)).send({ text: 'Інше' }).expect(200);
    const tree = (await agent.get(`/api/maps/${mapId}`)).body.map.nodes;
    expect(tree.find((n) => n.id === a1.id).text).toBe('A1');
  });

  it('повертає зміни порядку сусідів, щоб клієнт синхронізувався без перезавантаження', async () => {
    const { body } = await agent.post(`${url(a.id)}/duplicate`);
    const bChange = body.changes.find((c) => c.id === b.id);
    expect(bChange).toMatchObject({ parentId: rootId, order: 2 });
  });

  it('дублює листок і вкладену гілку, але не корінь', async () => {
    const leaf = await agent.post(`${url(b.id)}/duplicate`);
    expect(leaf.body.nodes).toHaveLength(1);
    const inner = await agent.post(`${url(a1.id)}/duplicate`);
    expect(inner.body.nodes[0]).toMatchObject({ parentId: a.id, text: 'A1 (копія)' });
    await agent.post(`${url(rootId)}/duplicate`).expect(400);
  });

  it('чужа карта і неіснуючий вузол дають 404', async () => {
    const intruder = await loggedInAgent(app, 'intruder@example.com');
    await intruder.post(`${url(a.id)}/duplicate`).expect(404);
    await agent.post(`${url('немає')}/duplicate`).expect(404);
  });

  it('не перевищує ліміт вузлів на карті', async () => {
    const big = (await agent.post('/api/maps').send({ title: 'Велика', template: 'project' })).body.map;
    const first = big.nodes.find((n) => n.text === 'Задачі'); // гілка з 4 вузлів
    // заповнюємо до ліміту вузлів дубльованням кореневої гілки, поки сервер не відмовить
    let status = 201;
    let guard = 0;
    while (status === 201 && guard++ < 3000) {
      const res = await agent.post(`/api/maps/${big.id}/nodes/${first.id}/duplicate`);
      status = res.status;
    }
    expect(status).toBe(400);
    const total = (await agent.get(`/api/maps/${big.id}`)).body.map.nodes.length;
    expect(total).toBeLessThanOrEqual(2000);
  });

  it('копія не бере вкладення оригіналу', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    await agent.post(`${url(a.id)}/attachments`.replace('/nodes/', '/nodes/') ).query({ name: 'a.png', mime: 'image/png' }).set('Content-Type', 'application/octet-stream').send(png).expect(201);
    const { body } = await agent.post(`${url(a.id)}/duplicate`);
    const tree = (await agent.get(`/api/maps/${mapId}`)).body.map.nodes;
    expect(tree.find((n) => n.id === body.nodes[0].id).attachments).toEqual([]);
    expect(tree.find((n) => n.id === a.id).attachments).toHaveLength(1);
  });
});
