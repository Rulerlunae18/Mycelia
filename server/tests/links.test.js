import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_LINK_LABEL } from '../src/validation.js';
import { makeTestApp } from './helpers/makeTestApp.js';

describe("зв'язки між вузлами", () => {
  let app, agent, mapId, rootId, a, b, c;
  const url = (id = '') => `/api/maps/${mapId}/links${id ? `/${id}` : ''}`;
  const addNode = async (text) => (await agent.post(`/api/maps/${mapId}/nodes`).send({ parentId: rootId, text })).body.node;
  const link = (fromId, toId, extra = {}) => agent.post(url()).send({ fromId, toId, ...extra });

  async function setup(options) {
    app = makeTestApp(options);
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'l@example.com', password: 'long-enough-pass' });
    const { body } = await agent.post('/api/maps').send({ title: 'Карта' });
    mapId = body.map.id;
    rootId = body.map.nodes[0].id;
    a = await addNode('A');
    b = await addNode('B');
    c = await addNode('C');
  }
  beforeEach(() => setup());

  it("створює зв'язок, і той приходить разом із картою", async () => {
    const res = await link(a.id, b.id, { label: ' впливає на ' }).expect(201);
    expect(res.body.link).toMatchObject({ mapId, fromId: a.id, toId: b.id, label: 'впливає на' });
    const { body } = await agent.get(`/api/maps/${mapId}`);
    expect(body.map.links).toHaveLength(1);
    expect(body.map.links[0].id).toBe(res.body.link.id);
  });

  it('підпис необов\'язковий: порожній стає null', async () => {
    expect((await link(a.id, b.id).expect(201)).body.link.label).toBeNull();
    expect((await link(b.id, c.id, { label: '   ' }).expect(201)).body.link.label).toBeNull();
  });

  it('напрямок має значення: A→B і B→A можуть існувати разом', async () => {
    await link(a.id, b.id).expect(201);
    await link(b.id, a.id).expect(201);
  });

  it('відхиляє зв\'язок із самим собою, дублікат, чужі й неіснуючі вузли', async () => {
    await link(a.id, a.id).expect(400);
    await link(a.id, b.id).expect(201);
    await link(a.id, b.id).expect(400);
    await link(a.id, 'nope').expect(400);
    await link('nope', a.id).expect(400);
    // вузол з іншої карти
    const other = (await agent.post('/api/maps').send({ title: 'Інша' })).body.map;
    await link(a.id, other.nodes[0].id).expect(400);
    await agent.post(url()).send({ fromId: a.id }).expect(400);
  });

  it('підпис не довший за межу', async () => {
    await link(a.id, b.id, { label: 'x'.repeat(MAX_LINK_LABEL + 1) }).expect(400);
    await link(a.id, b.id, { label: 'x'.repeat(MAX_LINK_LABEL) }).expect(201);
  });

  it('підпис можна змінити і прибрати', async () => {
    const { link: l } = (await link(a.id, b.id, { label: 'старий' })).body;
    expect((await agent.patch(url(l.id)).send({ label: 'новий' }).expect(200)).body.link.label).toBe('новий');
    expect((await agent.patch(url(l.id)).send({ label: '' }).expect(200)).body.link.label).toBeNull();
    expect((await agent.patch(url(l.id)).send({ label: null }).expect(200)).body.link.label).toBeNull();
    await agent.patch(url(l.id)).send({}).expect(400);
  });

  it('видаляє зв\'язок', async () => {
    const { link: l } = (await link(a.id, b.id)).body;
    await agent.delete(url(l.id)).expect(204);
    expect((await agent.get(`/api/maps/${mapId}`)).body.map.links).toHaveLength(0);
    await agent.delete(url(l.id)).expect(404);
  });

  it('зв\'язки зникають разом із вузлом, а решта лишаються', async () => {
    await link(a.id, b.id);
    await link(b.id, c.id);
    await link(c.id, a.id);
    await agent.delete(`/api/maps/${mapId}/nodes/${a.id}`).expect(200);
    const links = (await agent.get(`/api/maps/${mapId}`)).body.map.links;
    expect(links.map((l) => [l.fromId, l.toId])).toEqual([[b.id, c.id]]);
  });

  it('ліміт зв\'язків на карті', async () => {
    await setup({ maxLinks: 2 });
    await link(a.id, b.id).expect(201);
    await link(b.id, c.id).expect(201);
    await link(c.id, a.id).expect(400);
  });

  it('чужа карта: 404, без доступу: 401', async () => {
    const { link: l } = (await link(a.id, b.id)).body;
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ email: 'o@example.com', password: 'long-enough-pass' });
    await other.post(url()).send({ fromId: a.id, toId: c.id }).expect(404);
    await other.patch(url(l.id)).send({ label: 'злам' }).expect(404);
    await other.delete(url(l.id)).expect(404);
    await request(app).post(url()).send({ fromId: a.id, toId: c.id }).expect(401);
  });

  it('зв\'язок з іншої карти за чужим URL не знаходиться', async () => {
    const { link: l } = (await link(a.id, b.id)).body;
    const other = (await agent.post('/api/maps').send({ title: 'Друга' })).body.map;
    await agent.delete(`/api/maps/${other.id}/links/${l.id}`).expect(404);
  });
});
