import { describe, expect, it } from 'vitest';
import { NodePrototype, TemplateRegistry } from '../src/domain/prototype.js';
import { buildTemplateRegistry } from '../src/domain/templates.js';
import { CATEGORIES, PRIORITIES } from '../src/validation.js';

const sample = () =>
  NodePrototype.fromSnapshot({
    text: 'Корінь',
    style: { color: '#fff', shape: 'pill' },
    children: [
      { text: 'A', category: 'idea', children: [{ text: 'A1' }, { text: 'A2', collapsed: true }] },
      { text: 'B', priority: 'high' },
    ],
  });

describe('Prototype: NodePrototype', () => {
  it('clone дає глибоку незалежну копію: зміни копії не торкаються оригіналу', () => {
    const original = sample();
    const copy = original.clone();
    expect(copy).not.toBe(original);
    expect(copy.children[0]).not.toBe(original.children[0]);
    expect(copy.children[0].children[1]).not.toBe(original.children[0].children[1]);

    copy.text = 'Змінено';
    copy.children[0].children[0].text = 'Змінено теж';
    copy.style.color = '#000';
    copy.children.pop();

    expect(original.text).toBe('Корінь');
    expect(original.children[0].children[0].text).toBe('A1');
    expect(original.style.color).toBe('#fff');
    expect(original.children).toHaveLength(2);
  });

  it('копія містить усі дані оригіналу', () => {
    const copy = sample().clone();
    expect(copy.size()).toBe(5);
    expect(copy.children[0]).toMatchObject({ text: 'A', category: 'idea' });
    expect(copy.children[0].children[1]).toMatchObject({ text: 'A2', collapsed: true });
    expect(copy.children[1].priority).toBe('high');
  });

  it('fromRows збирає гілку з плоского списку у порядку order, лише обрану гілку', () => {
    const rows = [
      { id: 'r', parentId: null, order: 0, text: 'R', collapsed: false },
      { id: 'a', parentId: 'r', order: 1, text: 'A', collapsed: false, category: 'task' },
      { id: 'b', parentId: 'r', order: 0, text: 'B', collapsed: false },
      { id: 'a2', parentId: 'a', order: 1, text: 'A2', collapsed: false },
      { id: 'a1', parentId: 'a', order: 0, text: 'A1', collapsed: false },
    ];
    const branch = NodePrototype.fromRows(rows, 'a');
    expect(branch.text).toBe('A');
    expect(branch.category).toBe('task');
    expect(branch.children.map((c) => c.text)).toEqual(['A1', 'A2']);
    expect(branch.size()).toBe(3);
  });

  it('toRows дає нові id, батьків перед дітьми, і правильні parentId та order', () => {
    let n = 0;
    const rows = sample().toRows({ mapId: 'm', parentId: 'P', order: 3, newId: () => `id${++n}` });
    expect(rows.map((r) => r.id)).toEqual(['id1', 'id2', 'id3', 'id4', 'id5']);
    expect(rows[0]).toMatchObject({ parentId: 'P', order: 3, text: 'Корінь', mapId: 'm' });
    expect(rows[1]).toMatchObject({ parentId: 'id1', order: 0, text: 'A', category: 'idea' });
    expect(rows[2]).toMatchObject({ parentId: 'id2', order: 0, text: 'A1' });
    expect(rows[3]).toMatchObject({ parentId: 'id2', order: 1, text: 'A2', collapsed: true });
    expect(rows[4]).toMatchObject({ parentId: 'id1', order: 1, text: 'B' });
    // кожен батько йде раніше за дітей: інакше зовнішній ключ не спрацює
    rows.forEach((r, i) => r.parentId !== 'P' && expect(rows.findIndex((x) => x.id === r.parentId)).toBeLessThan(i));
  });
});

describe('Prototype: TemplateRegistry', () => {
  it('віддає копії, а не сам зразок, і не дає зареєструвати ключ двічі', () => {
    const reg = new TemplateRegistry().register('k', { title: 'K', description: 'd', prototype: sample() });
    const a = reg.instantiate('k');
    const b = reg.instantiate('k');
    a.text = 'зіпсовано';
    expect(b.text).toBe('Корінь');
    expect(reg.instantiate('k').text).toBe('Корінь');
    expect(reg.instantiate('немає')).toBeNull();
    expect(() => reg.register('k', { title: '', description: '', prototype: sample() })).toThrow();
    expect(reg.list()).toEqual([{ key: 'k', title: 'K', description: 'd', nodes: 5 }]);
  });
});

describe('вбудовані шаблони', () => {
  const registry = buildTemplateRegistry();

  it('є, мають унікальні ключі та непорожні дані', () => {
    const list = registry.list();
    expect(list.map((t) => t.key)).toEqual(['project', 'swot', 'brainstorm', 'week', 'coursework']);
    for (const t of list) {
      expect(t.title).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.nodes).toBeGreaterThan(3);
    }
  });

  it('усі категорії й терміновості в шаблонах допустимі для API, а тексти непорожні', () => {
    for (const { key } of registry.list()) {
      const walk = (p) => {
        expect(p.text.trim(), key).not.toBe('');
        if (p.category) expect(CATEGORIES, key).toContain(p.category);
        if (p.priority) expect(PRIORITIES, key).toContain(p.priority);
        p.children.forEach(walk);
      };
      walk(registry.instantiate(key));
    }
  });
});
