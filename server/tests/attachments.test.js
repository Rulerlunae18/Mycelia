import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ATTACHMENTS_PER_NODE } from '../src/domain/files.js';
import { makeTestApp } from './helpers/makeTestApp.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(40, 7)]);
const SCRIPT = Buffer.from('<script>alert(1)</script>');

async function loggedInAgent(app, email = 'a@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'long-enough-pass' });
  return agent;
}

const upload = (agent, mapId, nodeId, body, { name = 'f.bin', mime = 'application/octet-stream' } = {}) =>
  agent
    .post(`/api/maps/${mapId}/nodes/${nodeId}/attachments`)
    .query({ name, mime })
    .set('Content-Type', 'application/octet-stream')
    .send(body);

describe('вкладення', () => {
  let app, agent, mapId, nodeId, rootId;
  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
    const { body } = await agent.post('/api/maps').send({ title: 'Карта' });
    mapId = body.map.id;
    rootId = body.map.nodes[0].id;
    nodeId = (await agent.post(`/api/maps/${mapId}/nodes`).send({ parentId: rootId, text: 'Вузол' })).body.node.id;
  });

  it('вимагає авторизації', async () => {
    await upload(request(app), mapId, nodeId, PNG).expect(401);
  });

  it('завантажує картинку: тип визначається за вмістом, у відповіді немає ключа сховища', async () => {
    const res = await upload(agent, mapId, nodeId, PNG, { name: 'схема.png', mime: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.attachment).toMatchObject({ kind: 'image', mime: 'image/png', name: 'схема.png', size: PNG.length, nodeId });
    expect(res.body.attachment.storageKey).toBeUndefined();

    const mp4 = await upload(agent, mapId, nodeId, MP4, { name: 'a.mp4', mime: 'video/mp4' });
    expect(mp4.body.attachment.kind).toBe('video');
  });

  it('карта віддає вкладення всередині вузлів, теж без ключа сховища', async () => {
    await upload(agent, mapId, nodeId, PNG, { name: 'a.png', mime: 'image/png' });
    const { body } = await agent.get(`/api/maps/${mapId}`);
    const node = body.map.nodes.find((n) => n.id === nodeId);
    expect(node.attachments).toHaveLength(1);
    expect(node.attachments[0].storageKey).toBeUndefined();
    expect(body.map.nodes.find((n) => n.id === rootId).attachments).toEqual([]);
  });

  it('не вірить заявленому типу: HTML під виглядом картинки стає звичайним файлом', async () => {
    const res = await upload(agent, mapId, nodeId, SCRIPT, { name: 'x.png', mime: 'image/png' });
    expect(res.body.attachment).toMatchObject({ kind: 'file', mime: 'application/octet-stream' });
    const html = await upload(agent, mapId, nodeId, SCRIPT, { name: 'x.html', mime: 'text/html' });
    expect(html.body.attachment.kind).toBe('file');
    const svg = await upload(agent, mapId, nodeId, Buffer.from('<svg onload="x()"/>'), { name: 'x.svg', mime: 'image/svg+xml' });
    expect(svg.body.attachment.kind).toBe('file');
  });

  it('очищає ім’я файлу від шляху і керівних символів', async () => {
    const res = await upload(agent, mapId, nodeId, PNG, { name: '../../etc/pass"wd\n.png', mime: 'image/png' });
    expect(res.body.attachment.name).toBe('passwd.png');
    const empty = await upload(agent, mapId, nodeId, PNG, { name: '..', mime: 'image/png' });
    expect(empty.body.attachment.name).toBe('файл');
  });

  it('відхиляє порожній файл, неіснуючий вузол і перевищення ліміту на вузол', async () => {
    await upload(agent, mapId, nodeId, Buffer.alloc(0)).expect(400);
    await upload(agent, mapId, 'немає', PNG).expect(404);
    for (let i = 0; i < MAX_ATTACHMENTS_PER_NODE; i++) await upload(agent, mapId, nodeId, PNG, { mime: 'image/png' }).expect(201);
    await upload(agent, mapId, nodeId, PNG, { mime: 'image/png' }).expect(400);
  });

  it('віддає картинку inline із захисними заголовками', async () => {
    const { body } = await upload(agent, mapId, nodeId, PNG, { name: 'a.png', mime: 'image/png' });
    const res = await agent.get(`/api/maps/${mapId}/attachments/${body.attachment.id}/file`).buffer(true).parse((r, cb) => {
      const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(res.headers['content-security-policy']).toContain('sandbox');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body, PNG)).toBe(0);
  });

  it('небезпечний файл віддається лише для завантаження як octet-stream', async () => {
    const { body } = await upload(agent, mapId, nodeId, SCRIPT, { name: 'evil.html', mime: 'text/html' });
    const res = await agent.get(`/api/maps/${mapId}/attachments/${body.attachment.id}/file`);
    expect(res.headers['content-type']).toContain('application/octet-stream');
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
  });

  it('підтримує Range для відео: часткова відповідь 206 і 416 для некоректного діапазону', async () => {
    const { body } = await upload(agent, mapId, nodeId, MP4, { name: 'a.mp4', mime: 'video/mp4' });
    const url = `/api/maps/${mapId}/attachments/${body.attachment.id}/file`;
    const part = await agent.get(url).set('Range', 'bytes=4-11').buffer(true).parse((r, cb) => {
      const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe(`bytes 4-11/${MP4.length}`);
    expect(Buffer.compare(part.body, MP4.subarray(4, 12))).toBe(0);
    await agent.get(url).set('Range', `bytes=${MP4.length + 10}-`).expect(416);
    await agent.get(url).set('Range', 'bytes=abc').expect(416);
  });

  it('чужа карта і чуже вкладення недоступні (404), у тому числі через URL іншої власної карти', async () => {
    const { body } = await upload(agent, mapId, nodeId, PNG, { mime: 'image/png' });
    const id = body.attachment.id;
    const intruder = await loggedInAgent(app, 'intruder@example.com');
    await intruder.get(`/api/maps/${mapId}/attachments/${id}/file`).expect(404);
    await intruder.delete(`/api/maps/${mapId}/attachments/${id}`).expect(404);
    await upload(intruder, mapId, nodeId, PNG).expect(404);

    const other = (await agent.post('/api/maps').send({ title: 'Інша' })).body.map;
    await agent.get(`/api/maps/${other.id}/attachments/${id}/file`).expect(404);
  });

  it('видалення вкладення стирає і файл у сховищі', async () => {
    const { body } = await upload(agent, mapId, nodeId, PNG, { mime: 'image/png' });
    expect(app.locals.storage.files.size).toBe(1);
    await agent.delete(`/api/maps/${mapId}/attachments/${body.attachment.id}`).expect(204);
    expect(app.locals.storage.files.size).toBe(0);
  });

  it('видалення вузла і всієї карти стирає файли вкладень', async () => {
    await upload(agent, mapId, nodeId, PNG, { mime: 'image/png' });
    await upload(agent, mapId, rootId, PNG, { mime: 'image/png' });
    expect(app.locals.storage.files.size).toBe(2);
    await agent.delete(`/api/maps/${mapId}/nodes/${nodeId}`).expect(200);
    expect(app.locals.storage.files.size).toBe(1);
    await agent.delete(`/api/maps/${mapId}`).expect(204);
    expect(app.locals.storage.files.size).toBe(0);
  });
});
