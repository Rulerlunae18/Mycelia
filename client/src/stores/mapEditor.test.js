import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../api/http';
import { useMapEditorStore } from './mapEditor';

vi.mock('../api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), upload: vi.fn() },
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

  it('запізніла відповідь про іншу карту не перезаписує поточну', async () => {
    let releaseSlow;
    http.get.mockImplementationOnce(() => new Promise((res) => { releaseSlow = () => res({ map: { id: 'slow', title: 'Повільна', layout: 'tree', nodes: [row('s', null, 'S')] } }); }));
    http.get.mockResolvedValueOnce({ map: { id: 'fast', title: 'Швидка', layout: 'tree', nodes: [row('f', null, 'F')] } });
    const slow = store.load('slow');
    await store.load('fast');
    releaseSlow();
    await slow;
    expect(store.map.id).toBe('fast');
    expect(store.root.id).toBe('f');
  });

  it('перейменовує карту', async () => {
    http.patch.mockResolvedValue({ map: { id: 'm1', title: 'Нова назва' } });
    await store.renameMap('Нова назва');
    expect(http.patch).toHaveBeenCalledWith('/maps/m1', { title: 'Нова назва' });
    expect(store.map.title).toBe('Нова назва');
  });

  it('створює область з усієї гілки, перейменовує і видаляє її', async () => {
    http.post.mockResolvedValue({ boundary: { id: 'b1', label: 'Область 1', nodeIds: ['a', 'a1'] } });
    await store.addBoundaryForBranch('a');
    expect(http.post).toHaveBeenCalledWith('/maps/m1/boundaries', { label: 'Область 1', nodeIds: ['a', 'a1'] });
    expect(store.boundaries).toHaveLength(1);

    http.patch.mockResolvedValue({ boundary: { id: 'b1', label: 'Фаза' } });
    await store.renameBoundary('b1', 'Фаза');
    expect(store.boundaries[0].label).toBe('Фаза');

    http.delete.mockResolvedValue({});
    await store.removeBoundary('b1');
    expect(store.boundaries).toHaveLength(0);
  });

  it('видалення вузла прибирає його з областей, порожня область зникає', async () => {
    http.post.mockResolvedValue({ boundary: { id: 'b1', label: 'X', nodeIds: ['a', 'a1'] } });
    await store.addBoundaryForBranch('a');
    http.post.mockResolvedValue({ boundary: { id: 'b2', label: 'Y', nodeIds: ['a1'] } });
    await store.addBoundaryForBranch('a1');
    http.delete.mockResolvedValue({ deleted: ['a1'], changes: [] });
    await store.remove('a1');
    expect(store.boundaries.map((b) => [b.id, b.nodeIds])).toEqual([['b1', ['a']]]);
  });

  it('вантажить вкладення на вузол, рахує їх і дає вибраному вузлу список', async () => {
    http.upload.mockImplementation(async (_path, file) => ({
      attachment: { id: `att-${file.name}`, nodeId: 'a', kind: 'image', name: file.name, size: file.size },
    }));
    const done = await store.uploadAttachments('a', [{ name: 'x.png', size: 10 }, { name: 'y.png', size: 20 }]);
    expect(done).toBe(2);
    expect(http.upload).toHaveBeenCalledWith('/maps/m1/nodes/a/attachments', { name: 'x.png', size: 10 });
    expect(store.attachmentCounts).toEqual({ a: 2 });
    store.select('a');
    expect(store.selectedAttachments.map((a) => a.name)).toEqual(['x.png', 'y.png']);
    store.select('b');
    expect(store.selectedAttachments).toEqual([]);
  });

  it('не вантажить завідомо непридатний файл, а вже завантажені лишає', async () => {
    http.upload.mockResolvedValue({ attachment: { id: 'ok', nodeId: 'a', kind: 'file', name: 'ok.txt', size: 5 } });
    await expect(
      store.uploadAttachments('a', [{ name: 'ok.txt', size: 5 }, { name: 'huge.bin', size: 999 * 1024 * 1024 }, { name: 'later.txt', size: 1 }]),
    ).rejects.toThrow(/huge\.bin/);
    expect(http.upload).toHaveBeenCalledTimes(1);
    expect(store.attachmentCounts).toEqual({ a: 1 });
  });

  it('видаляє вкладення', async () => {
    http.upload.mockResolvedValue({ attachment: { id: 'k', nodeId: 'a', kind: 'file', name: 'k.txt', size: 5 } });
    await store.uploadAttachments('a', [{ name: 'k.txt', size: 5 }]);
    http.delete.mockResolvedValue(null);
    await store.removeAttachment('a', 'k');
    expect(http.delete).toHaveBeenCalledWith('/maps/m1/attachments/k');
    expect(store.attachmentCounts).toEqual({});
  });
});
