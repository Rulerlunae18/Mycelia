import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../api/http';
import { useMapEditorStore } from './mapEditor';

vi.mock('../api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const row = (id, parentId, text, order = 0) => ({
  id, mapId: 'm1', parentId, text, order, collapsed: false,
});

describe('mapEditor store', () => {
  let store;
  beforeEach(async () => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    store = useMapEditorStore();
    http.get.mockResolvedValue({
      map: {
        id: 'm1', title: 'Карта', layout: 'radial',
        nodes: [row('r', null, 'Корінь'), row('a', 'r', 'A', 0), row('b', 'r', 'B', 1), row('a1', 'a', 'A1')],
      },
    });
    await store.load('m1');
  });

  it('завантажує карту і будує дерево', () => {
    expect(store.map.title).toBe('Карта');
    expect(store.map.nodes).toBeUndefined();
    expect(store.root.size()).toBe(4);
    expect(store.root.children.map((n) => n.text)).toEqual(['A', 'B']);
  });

  it('додає дитину після відповіді сервера', async () => {
    http.post.mockResolvedValue({ node: row('n', 'b', 'Нова ідея') });
    await store.addChild('b');
    expect(http.post).toHaveBeenCalledWith('/maps/m1/nodes', { parentId: 'b', text: 'Нова ідея' });
    expect(store.root.find('n').parent.id).toBe('b');
  });

  it('перейменовує вузол', async () => {
    http.patch.mockResolvedValue({ node: row('a', 'r', 'Змінено') });
    await store.rename('a', 'Змінено');
    expect(store.root.find('a').text).toBe('Змінено');
  });

  it('перемикає згортання', async () => {
    http.patch.mockResolvedValue({ node: { ...row('a', 'r', 'A'), collapsed: true } });
    await store.toggleCollapsed('a');
    expect(http.patch).toHaveBeenCalledWith('/maps/m1/nodes/a', { collapsed: true });
    expect(store.root.find('a').collapsed).toBe(true);
  });

  it('видаляє піддерево і застосовує нові позиції сусідів', async () => {
    http.delete.mockResolvedValue({
      deleted: ['a', 'a1'],
      changes: [{ id: 'b', parentId: 'r', order: 0 }],
    });
    await store.remove('a');
    expect(store.root.size()).toBe(2);
    expect(store.root.children.map((n) => n.id)).toEqual(['b']);
  });

  it('переміщує вузол за відповіддю сервера', async () => {
    http.post.mockResolvedValue({
      changes: [
        { id: 'a', parentId: 'b', order: 0 },
        { id: 'b', parentId: 'r', order: 0 },
      ],
    });
    await store.move('a', 'b', 0);
    expect(store.root.find('a').parent.id).toBe('b');
    expect(store.root.find('a1').depth).toBe(3);
  });
});
