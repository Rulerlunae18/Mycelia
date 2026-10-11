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

  it('виділяє вузол, а видалення виділеного піддерева знімає виділення', async () => {
    store.select('a1');
    expect(store.selected.text).toBe('A1');
    http.delete.mockResolvedValue({ deleted: ['a', 'a1'], changes: [] });
    await store.remove('a');
    expect(store.selectedId).toBeNull();
    expect(store.selected).toBeNull();
  });

  it('видалення іншого вузла виділення не чіпає', async () => {
    store.select('b');
    http.delete.mockResolvedValue({ deleted: ['a', 'a1'], changes: [] });
    await store.remove('a');
    expect(store.selectedId).toBe('b');
  });

  it('addChildAndSelect додає вузол, розгортає згорнутого батька і виділяє новий вузол', async () => {
    store.nodes.find((n) => n.id === 'a').collapsed = true;
    http.post.mockResolvedValue({ node: row('n', 'a', 'Нова ідея', 1) });
    http.patch.mockResolvedValue({ node: { ...row('a', 'r', 'A'), collapsed: false } });
    await store.addChildAndSelect('a');
    expect(http.patch).toHaveBeenCalledWith('/maps/m1/nodes/a', { collapsed: false });
    expect(store.root.find('a').collapsed).toBe(false);
    expect(store.selectedId).toBe('n');
  });

  it('addChildAndSelect не чіпає розгорнутого батька', async () => {
    http.post.mockResolvedValue({ node: row('n', 'b', 'Нова ідея') });
    await store.addChildAndSelect('b');
    expect(http.patch).not.toHaveBeenCalled();
    expect(store.selectedId).toBe('n');
  });

  it('змінює розкладку одразу і зберігає її на сервері', async () => {
    http.patch.mockResolvedValue({ map: { id: 'm1', layout: 'tree' } });
    const pending = store.setLayout('tree');
    expect(store.layout).toBe('tree');
    await pending;
    expect(http.patch).toHaveBeenCalledWith('/maps/m1', { layout: 'tree' });
  });

  it('якщо сервер відмовив, розкладка повертається назад', async () => {
    http.patch.mockRejectedValue(new Error('Мережа'));
    await expect(store.setLayout('bilateral')).rejects.toThrow('Мережа');
    expect(store.layout).toBe('radial');
  });

  it('та сама розкладка запиту не робить', async () => {
    await store.setLayout('radial');
    expect(http.patch).not.toHaveBeenCalled();
  });

  it('завантаження іншої карти скидає виділення', async () => {
    store.select('a');
    await store.load('m1');
    expect(store.selectedId).toBeNull();
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

  it('після переміщення в згорнуту гілку розгортає її', async () => {
    store.nodes.find((n) => n.id === 'b').collapsed = true;
    http.post.mockResolvedValue({ changes: [{ id: 'a1', parentId: 'b', order: 0 }, { id: 'a', parentId: 'r', order: 0 }] });
    http.patch.mockResolvedValue({ node: { id: 'b', collapsed: false } });
    await store.moveAndReveal('a1', 'b', 0);
    expect(http.patch).toHaveBeenCalledWith('/maps/m1/nodes/b', { collapsed: false });
    expect(store.root.find('b').collapsed).toBe(false);
  });

  it('додає сусіда одразу після вузла, зсуває наступних і виділяє новий', async () => {
    http.post.mockResolvedValue({ node: row('n', 'r', 'Нова ідея', 1) });
    await store.addSiblingAndSelect('a');
    expect(http.post).toHaveBeenCalledWith('/maps/m1/nodes', { parentId: 'r', text: 'Нова ідея', index: 1 });
    expect(store.root.children.map((c) => c.id)).toEqual(['a', 'n', 'b']);
    expect(store.selectedId).toBe('n');
  });

  it('у кореня сусіда немає: Enter на корені додає дитину', async () => {
    http.post.mockResolvedValue({ node: row('n', 'r', 'Нова ідея', 2) });
    await store.addSiblingAndSelect('r');
    expect(store.root.find('n').parent.id).toBe('r');
  });
});
