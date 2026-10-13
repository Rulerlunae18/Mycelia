import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { NodePrototype } from '../src/domain/prototype.js';
import { MAX_NOTE } from '../src/validation.js';
import { makeTestApp } from './helpers/makeTestApp.js';

describe('нотатка до вузла', () => {
  let app, agent, mapId, rootId, a;
  const base = () => `/api/maps/${mapId}/nodes`;

  beforeEach(async () => {
    app = makeTestApp();
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'n@example.com', password: 'long-enough-pass' });
    const { body } = await agent.post('/api/maps').send({ title: 'Карта' });
    mapId = body.map.id;
    rootId = body.map.nodes[0].id;
    a = (await agent.post(base()).send({ parentId: rootId, text: 'A' })).body.node;
  });

  it('за замовчуванням нотатки немає', async () => {
    const { body } = await agent.get(`/api/maps/${mapId}`);
    expect(body.map.nodes.find((n) => n.id === a.id).note ?? null).toBeNull();
  });

  it('нотатку можна записати, прочитати з картою і змінити', async () => {
    const text = 'Перший рядок\n\nДругий абзац з «лапками» і <b>тегами</b>.';
    const res = await agent.patch(`${base()}/${a.id}`).send({ note: text }).expect(200);
    expect(res.body.node.note).toBe(text);
    const { body } = await agent.get(`/api/maps/${mapId}`);
    expect(body.map.nodes.find((n) => n.id === a.id).note).toBe(text);
    await agent.patch(`${base()}/${a.id}`).send({ note: 'Новий текст' }).expect(200);
    expect((await agent.get(`/api/maps/${mapId}`)).body.map.nodes.find((n) => n.id === a.id).note).toBe('Новий текст');
  });

  it('порожня, пробільна і null нотатка стають «без нотатки»', async () => {
    await agent.patch(`${base()}/${a.id}`).send({ note: 'щось' });
    for (const note of ['', '   \n ', null]) {
      await agent.patch(`${base()}/${a.id}`).send({ note: 'щось' });
      const res = await agent.patch(`${base()}/${a.id}`).send({ note }).expect(200);
      expect(res.body.node.note).toBeNull();
    }
  });

  it('занадто довгу нотатку відхиляє, на межі приймає', async () => {
    await agent.patch(`${base()}/${a.id}`).send({ note: 'x'.repeat(MAX_NOTE + 1) }).expect(400);
    await agent.patch(`${base()}/${a.id}`).send({ note: 'x'.repeat(MAX_NOTE) }).expect(200);
    await agent.patch(`${base()}/${a.id}`).send({ note: 42 }).expect(400);
  });

  it('чужа карта: нотатку змінити не можна', async () => {
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ email: 'o@example.com', password: 'long-enough-pass' });
    await other.patch(`${base()}/${a.id}`).send({ note: 'злам' }).expect(404);
  });

  it('дублювання гілки копіює нотатки', async () => {
    await agent.patch(`${base()}/${a.id}`).send({ note: 'опис А' });
    const { body } = await agent.post(`${base()}/${a.id}/duplicate`).expect(201);
    const copy = body.nodes.find((n) => n.text.includes('(копія)'));
    expect(copy.note).toBe('опис А');
  });

  it('відновлення гілки повертає нотатку', async () => {
    await agent.patch(`${base()}/${a.id}`).send({ note: 'опис А' });
    const { body: before } = await agent.get(`/api/maps/${mapId}`);
    const row = before.map.nodes.find((n) => n.id === a.id);
    await agent.delete(`${base()}/${a.id}`).expect(200);
    const { id, parentId, text, collapsed, style, category, priority, note, order } = row;
    await agent.post(`${base()}/restore`).send({ nodes: [{ id, parentId, text, collapsed, style, category, priority, note, order }] }).expect(201);
    expect((await agent.get(`/api/maps/${mapId}`)).body.map.nodes.find((n) => n.id === a.id).note).toBe('опис А');
  });

  it('прототип клонує нотатку незалежно від оригіналу', () => {
    const proto = NodePrototype.fromSnapshot({ text: 'A', note: 'опис', children: [{ text: 'B', note: 'вкладений' }] });
    const copy = proto.clone();
    copy.note = 'змінено';
    copy.children[0].note = null;
    expect(proto.note).toBe('опис');
    expect(proto.children[0].note).toBe('вкладений');
    const rows = proto.toRows({ mapId: 'm', parentId: 'p' });
    expect(rows.map((r) => r.note)).toEqual(['опис', 'вкладений']);
  });
});
