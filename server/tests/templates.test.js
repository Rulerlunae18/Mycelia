import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/makeTestApp.js';

async function loggedInAgent(app, email = 'a@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'long-enough-pass' });
  return agent;
}

describe('шаблони карт', () => {
  let app, agent;
  beforeEach(async () => {
    app = makeTestApp();
    agent = await loggedInAgent(app);
  });

  it('список шаблонів вимагає авторизації і віддає ключ, назву й кількість вузлів', async () => {
    await request(app).get('/api/templates').expect(401);
    const { body } = await agent.get('/api/templates').expect(200);
    expect(body.templates.map((t) => t.key)).toContain('swot');
    expect(body.templates[0]).toEqual(expect.objectContaining({ key: expect.any(String), title: expect.any(String), nodes: expect.any(Number) }));
  });

  it('створює карту з шаблону: корінь від користувача, решта з копії зразка', async () => {
    const res = await agent.post('/api/maps').send({ title: 'Мій SWOT', template: 'swot' });
    expect(res.status).toBe(201);
    const nodes = res.body.map.nodes;
    const root = nodes.find((n) => n.parentId === null);
    expect(root.text).toBe('Мій SWOT');
    const kids = nodes.filter((n) => n.parentId === root.id).sort((a, b) => a.order - b.order);
    expect(kids.map((n) => n.text)).toEqual(['Сильні сторони', 'Слабкі сторони', 'Можливості', 'Загрози']);
    expect(kids[3].category).toBe('risk');
    expect(nodes.filter((n) => n.parentId === kids[0].id).map((n) => n.text)).toEqual(['Додай ідею']);

    // карта справді збережена і відкривається
    const loaded = await agent.get(`/api/maps/${res.body.map.id}`);
    expect(loaded.body.map.nodes).toHaveLength(nodes.length);
  });

  it('дві карти з одного шаблону незалежні: в усіх вузлів різні id, зміна однієї не чіпає іншої', async () => {
    const a = (await agent.post('/api/maps').send({ title: 'A', template: 'week' })).body.map;
    const b = (await agent.post('/api/maps').send({ title: 'B', template: 'week' })).body.map;
    const ids = new Set([...a.nodes, ...b.nodes].map((n) => n.id));
    expect(ids.size).toBe(a.nodes.length + b.nodes.length);

    const monday = a.nodes.find((n) => n.text === 'Понеділок');
    await agent.patch(`/api/maps/${a.id}/nodes/${monday.id}`).send({ text: 'Змінено' }).expect(200);
    const again = (await agent.post('/api/maps').send({ title: 'C', template: 'week' })).body.map;
    expect(again.nodes.some((n) => n.text === 'Понеділок')).toBe(true);
  });

  it('невідомий шаблон дає 400, а без шаблону карта створюється як раніше', async () => {
    await agent.post('/api/maps').send({ title: 'X', template: 'немає-такого' }).expect(400);
    const plain = await agent.post('/api/maps').send({ title: 'Звичайна' });
    expect(plain.body.map.nodes).toHaveLength(1);
  });

  it('тема й розкладка з запиту діють і для карти з шаблону', async () => {
    const res = await agent.post('/api/maps').send({ title: 'T', template: 'project', theme: 'paper', layout: 'tree' });
    expect(res.body.map).toMatchObject({ theme: 'paper', layout: 'tree' });
  });

  it('без theme і layout карта з шаблону отримує ті самі умовчання, що й звичайна', async () => {
    const res = await agent.post('/api/maps').send({ title: 'T', template: 'project' });
    expect(res.body.map).toMatchObject({ theme: 'berry', layout: 'bilateral' });
  });
});
