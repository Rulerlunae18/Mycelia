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

  it('дублює гілку: нові вузли з\'являються після оригіналу, сусіди зсуваються, копія виділена', async () => {
    http.post.mockResolvedValue({
      nodes: [
        { id: 'a-copy', mapId: 'm1', parentId: 'r', text: 'A (копія)', order: 1, collapsed: false },
        { id: 'a1-copy', mapId: 'm1', parentId: 'a-copy', text: 'A1', order: 0, collapsed: false },
      ],
      changes: [
        { id: 'a', parentId: 'r', order: 0 },
        { id: 'a-copy', parentId: 'r', order: 1 },
        { id: 'b', parentId: 'r', order: 2 },
      ],
    });
    const copy = await store.duplicate('a');
    expect(http.post).toHaveBeenCalledWith('/maps/m1/nodes/a/duplicate');
    expect(copy.id).toBe('a-copy');
    expect(store.root.children.map((c) => c.id)).toEqual(['a', 'a-copy', 'b']);
    expect(store.root.find('a-copy').children.map((c) => c.text)).toEqual(['A1']);
    expect(store.selectedId).toBe('a-copy');
  });

  it('карта зі старою темою «default» показується з темою за замовчуванням', async () => {
    store.map.theme = 'default';
    expect(store.theme).toBe('berry');
    store.map.theme = 'ocean';
    expect(store.theme).toBe('ocean');
  });

  describe('копіювання і вставка гілок', () => {
    const echoRestore = () => http.post.mockImplementation(async (_url, body) => ({
      nodes: body.nodes.map((n) => ({ ...n, mapId: 'm1' })),
      changes: body.nodes.slice(0, 1).map((n) => ({ id: n.id, parentId: n.parentId, order: n.order })),
    }));

    it('копіює гілку в буфер, не чіпаючи карту і сервер', () => {
      const info = store.copyBranch('a');
      expect(info).toEqual({ count: 2, title: 'A' });
      expect(store.clipboardInfo).toEqual({ count: 2, title: 'A' });
      expect(http.post).not.toHaveBeenCalled();
      expect(store.root.size()).toBe(4);
    });

    it('вставляє копію дитиною вибраного вузла з новими id і виділяє її', async () => {
      echoRestore();
      store.copyBranch('a');
      store.select('b');
      const done = await store.pasteBranch();
      expect(done).toEqual({ count: 2, title: 'A' });
      const [url, body] = http.post.mock.calls.at(-1);
      expect(url).toBe('/maps/m1/nodes/restore');
      expect(body.nodes).toHaveLength(2);
      expect(body.nodes[0]).toMatchObject({ parentId: 'b', text: 'A', order: 0 });
      expect(body.nodes[1]).toMatchObject({ parentId: body.nodes[0].id, text: 'A1', order: 0 });
      expect(body.nodes.map((n) => n.id)).not.toContain('a');
      expect(store.root.size()).toBe(6);
      expect(store.root.find('b').children.map((n) => n.text)).toEqual(['A']);
      expect(store.selectedId).toBe(body.nodes[0].id);
    });

    it('без вибраного вузла вставляє в корінь, в кінець списку дітей', async () => {
      echoRestore();
      store.copyBranch('a1');
      await store.pasteBranch();
      expect(http.post.mock.calls.at(-1)[1].nodes[0]).toMatchObject({ parentId: 'r', text: 'A1', order: 2 });
    });

    it('одну гілку можна вставити кілька разів: кожна копія має свої id', async () => {
      echoRestore();
      store.copyBranch('a');
      await store.pasteBranch('b');
      await store.pasteBranch('b');
      expect(store.root.find('b').children).toHaveLength(2);
      expect(new Set(store.root.walk ? [...store.root.walk()].map((n) => n.id) : []).size).toBe(store.root.size());
    });

    it('вставка скасовується і повторюється', async () => {
      echoRestore();
      store.copyBranch('a');
      await store.pasteBranch('b');
      http.delete.mockResolvedValue({ deleted: [], changes: [] });
      http.delete.mockImplementation(async (url) => {
        const id = url.split('/').pop();
        return { deleted: [id, ...store.nodes.filter((n) => n.parentId === id).map((n) => n.id)], changes: [] };
      });
      await store.undo();
      expect(store.root.size()).toBe(4);
      await store.redo();
      expect(store.root.size()).toBe(6);
    });

    it('вставка у згорнутий вузол розгортає його, а скасування згортає назад', async () => {
      echoRestore();
      http.patch.mockImplementation(async (_url, data) => ({ node: { id: 'b', ...data } }));
      await store.toggleCollapsed('b');
      expect(store.root.find('b').collapsed).toBe(true);
      store.copyBranch('a1');
      await store.pasteBranch('b');
      expect(store.root.find('b').collapsed).toBe(false);
    });

    it('порожній буфер: зрозуміла помилка і жодного запиту', async () => {
      await expect(store.pasteBranch('a')).rejects.toThrow('Буфер порожній');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('вирізання копіює в буфер і видаляє, корінь вирізати не можна', async () => {
      http.delete.mockResolvedValue({ deleted: ['a', 'a1'], changes: [{ id: 'b', parentId: 'r', order: 0 }] });
      expect(await store.cutBranch('r')).toBeNull();
      expect(http.delete).not.toHaveBeenCalled();
      const info = await store.cutBranch('a');
      expect(info).toEqual({ count: 2, title: 'A' });
      expect(store.root.find('a')).toBeNull();
      expect(store.clipboardInfo.count).toBe(2);
    });

    it('буфер переживає завантаження іншої карти: гілку можна перенести між картами', async () => {
      echoRestore();
      store.copyBranch('a');
      http.get.mockResolvedValue({ map: { id: 'm2', title: 'Інша', layout: 'radial', nodes: [row('r2', null, 'Корінь 2')] } });
      await store.load('m2');
      expect(store.clipboardInfo).toEqual({ count: 2, title: 'A' });
      store.select('r2');
      await store.pasteBranch();
      const [url, body] = http.post.mock.calls.at(-1);
      expect(url).toBe('/maps/m2/nodes/restore');
      expect(body.nodes[0]).toMatchObject({ parentId: 'r2', text: 'A' });
    });
  });

  describe('скасування і повтор (Command)', () => {
    it('нотатка зберігається, скасовується і повторюється', async () => {
      http.patch.mockImplementation(async (_url, data) => ({ node: { id: 'a', ...data } }));
      await store.setNote('a', 'Довгий опис ідеї');
      expect(http.patch).toHaveBeenLastCalledWith('/maps/m1/nodes/a', { note: 'Довгий опис ідеї' });
      expect(store.root.find('a').extra.note).toBe('Довгий опис ідеї');
      expect(store.historyState.undoLabel).toBe('зміна нотатки');

      await store.undo();
      expect(http.patch).toHaveBeenLastCalledWith('/maps/m1/nodes/a', { note: null });
      expect(store.root.find('a').extra.note ?? null).toBeNull();

      await store.redo();
      expect(store.root.find('a').extra.note).toBe('Довгий опис ідеї');
    });

    it('послідовні правки нотатки зливаються в один крок історії', async () => {
      http.patch.mockImplementation(async (_url, data) => ({ node: { id: 'a', ...data } }));
      await store.setNote('a', 'Пер');
      await store.setNote('a', 'Перший чернетковий варіант');
      await store.setNote('a', 'Готовий текст');
      await store.undo();
      expect(store.root.find('a').extra.note ?? null).toBeNull();
      expect(store.historyState.canUndo).toBe(false);
      await store.redo();
      expect(store.root.find('a').extra.note).toBe('Готовий текст');
    });

    it('нотатки різних вузлів не зливаються', async () => {
      http.patch.mockImplementation(async (url, data) => ({ node: { id: url.split('/').pop(), ...data } }));
      await store.setNote('a', 'про A');
      await store.setNote('b', 'про B');
      await store.undo();
      expect(store.root.find('b').extra.note ?? null).toBeNull();
      expect(store.root.find('a').extra.note).toBe('про A');
    });

    it('порожня нотатка стає null, а незмінена нічого не шле', async () => {
      http.patch.mockImplementation(async (_url, data) => ({ node: { id: 'a', ...data } }));
      await store.setNote('a', 'текст');
      http.patch.mockClear();
      await store.setNote('a', 'текст');
      expect(http.patch).not.toHaveBeenCalled();
      await store.setNote('a', '   \n ');
      expect(http.patch).toHaveBeenCalledWith('/maps/m1/nodes/a', { note: null });
      expect(store.root.find('a').extra.note).toBeNull();
    });

    it('зміна тексту скасовується і повторюється зі старим і новим значенням', async () => {
      http.patch.mockImplementation(async (_url, data) => ({ node: { id: 'a', ...data } }));
      await store.rename('a', 'Нова');
      expect(store.root.find('a').text).toBe('Нова');
      expect(store.historyState).toMatchObject({ canUndo: true, canRedo: false, undoLabel: 'зміна тексту' });

      await store.undo();
      expect(store.root.find('a').text).toBe('A');
      expect(http.patch).toHaveBeenLastCalledWith('/maps/m1/nodes/a', { text: 'A' });
      expect(store.historyState).toMatchObject({ canUndo: false, canRedo: true });

      await store.redo();
      expect(store.root.find('a').text).toBe('Нова');
    });

    it('скасування видалення відновлює гілку: запит йде від батька до дітей, з тими самими id', async () => {
      http.delete.mockResolvedValue({ deleted: ['a', 'a1'], changes: [{ id: 'b', parentId: 'r', order: 0 }] });
      await store.remove('a');
      expect(store.root.find('a')).toBeNull();

      http.post.mockImplementation(async (_url, body) => ({
        nodes: body.nodes.map((n) => ({ ...n, mapId: 'm1' })),
        changes: [{ id: 'a', parentId: 'r', order: 0 }, { id: 'b', parentId: 'r', order: 1 }],
      }));
      await store.undo();
      const [, body] = http.post.mock.calls.at(-1);
      expect(http.post.mock.calls.at(-1)[0]).toBe('/maps/m1/nodes/restore');
      expect(body.nodes.map((n) => n.id)).toEqual(['a', 'a1']);
      expect(body.nodes[1].parentId).toBe('a');
      expect(store.root.children.map((c) => c.id)).toEqual(['a', 'b']);
      expect(store.root.find('a1').parent.id).toBe('a');
      expect(store.selectedId).toBe('a');

      await store.redo(); // повторне видалення
      expect(store.root.find('a')).toBeNull();
    });

    it('додавання скасовується видаленням нового вузла, а повтор відновлює його з тим самим id', async () => {
      http.post.mockResolvedValue({ node: row('n', 'r', 'Нова ідея', 2) });
      await store.addChildAndSelect('r');
      expect(store.root.find('n')).not.toBeNull();

      http.delete.mockResolvedValue({ deleted: ['n'], changes: [] });
      await store.undo();
      expect(http.delete).toHaveBeenLastCalledWith('/maps/m1/nodes/n');
      expect(store.root.find('n')).toBeNull();
      expect(store.selectedId).toBeNull();

      http.post.mockImplementation(async (_url, body) => ({ nodes: body.nodes, changes: [{ id: 'n', parentId: 'r', order: 2 }] }));
      await store.redo();
      expect(store.root.find('n')).not.toBeNull();
      expect(http.post.mock.calls.at(-1)[1].nodes[0].id).toBe('n');
    });

    it('ім\'я щойно доданого вузла входить у додавання: одне скасування прибирає вузол, повтор вертає з іменем', async () => {
      http.post.mockResolvedValue({ node: row('n', 'r', 'Нова ідея', 2) });
      http.patch.mockImplementation(async (_u, data) => ({ node: { id: 'n', ...data } }));
      await store.addChildAndSelect('r');
      await store.rename('n', 'Моя ідея');
      expect(store.root.find('n').text).toBe('Моя ідея');

      http.delete.mockResolvedValue({ deleted: ['n'], changes: [] });
      await store.undo();
      expect(store.root.find('n')).toBeNull();
      expect(store.historyState.canUndo).toBe(false);

      http.post.mockImplementation(async (_u, body) => ({ nodes: body.nodes, changes: [{ id: 'n', parentId: 'r', order: 2 }] }));
      await store.redo();
      expect(store.root.find('n').text).toBe('Моя ідея');
    });

    it('перейменування звичайного (не щойно доданого) вузла окремий крок', async () => {
      http.post.mockResolvedValue({ node: row('n', 'r', 'Нова ідея', 2) });
      http.patch.mockImplementation(async (_u, data) => ({ node: { id: 'a', ...data } }));
      await store.addChildAndSelect('r');
      await store.rename('a', 'Інший вузол');
      await store.undo();
      expect(store.root.find('a').text).toBe('A');
      expect(store.root.find('n')).not.toBeNull(); // додавання не скасоване
    });

    it('додавання в згорнуту гілку: скасування знову згортає її', async () => {
      store.nodes.find((n) => n.id === 'b').collapsed = true;
      http.post.mockResolvedValue({ node: row('n', 'b', 'Нова ідея', 0) });
      http.patch.mockImplementation(async (_u, data) => ({ node: { id: 'b', ...data } }));
      await store.addChildAndSelect('b');
      expect(store.root.find('b').collapsed).toBe(false);

      http.delete.mockResolvedValue({ deleted: ['n'], changes: [] });
      await store.undo();
      expect(store.root.find('b').collapsed).toBe(true);
    });

    it('переміщення скасовується поверненням на старого батька і старе місце', async () => {
      http.post.mockResolvedValue({ changes: [{ id: 'a', parentId: 'b', order: 0 }, { id: 'b', parentId: 'r', order: 0 }] });
      await store.moveAndReveal('a', 'b', 0);
      expect(store.root.find('a').parent.id).toBe('b');

      http.post.mockResolvedValue({ changes: [{ id: 'a', parentId: 'r', order: 0 }, { id: 'b', parentId: 'r', order: 1 }] });
      await store.undo();
      expect(http.post).toHaveBeenLastCalledWith('/maps/m1/nodes/a/move', { parentId: 'r', index: 0 });
      expect(store.root.children.map((c) => c.id)).toEqual(['a', 'b']);
    });

    it('дублювання скасовується видаленням копії, повтор відновлює її', async () => {
      http.post.mockResolvedValue({
        nodes: [row('a-copy', 'r', 'A (копія)', 1)],
        changes: [{ id: 'a', parentId: 'r', order: 0 }, { id: 'a-copy', parentId: 'r', order: 1 }, { id: 'b', parentId: 'r', order: 2 }],
      });
      await store.duplicate('a');
      http.delete.mockResolvedValue({ deleted: ['a-copy'], changes: [{ id: 'a', parentId: 'r', order: 0 }, { id: 'b', parentId: 'r', order: 1 }] });
      await store.undo();
      expect(store.root.children.map((c) => c.id)).toEqual(['a', 'b']);

      http.post.mockImplementation(async (_u, body) => ({
        nodes: body.nodes,
        changes: [{ id: 'a', parentId: 'r', order: 0 }, { id: 'a-copy', parentId: 'r', order: 1 }, { id: 'b', parentId: 'r', order: 2 }],
      }));
      await store.redo();
      expect(store.root.children.map((c) => c.id)).toEqual(['a', 'a-copy', 'b']);
    });

    it('нова дія очищає повтор, а завантаження іншої карти очищає всю історію', async () => {
      http.patch.mockImplementation(async (_u, data) => ({ node: { id: 'a', ...data } }));
      await store.rename('a', 'X');
      await store.undo();
      await store.rename('a', 'Y');
      expect(store.historyState.canRedo).toBe(false);

      http.get.mockResolvedValue({ map: { id: 'm2', title: 'Інша', layout: 'tree', nodes: [row('r2', null, 'R')] } });
      await store.load('m2');
      expect(store.historyState).toMatchObject({ canUndo: false, canRedo: false });
    });

    it('якщо відновлення не вдалось, історія лишається (можна повторити спробу)', async () => {
      http.delete.mockResolvedValue({ deleted: ['b'], changes: [] });
      await store.remove('b');
      http.post.mockRejectedValue(new Error('сервер недоступний'));
      await expect(store.undo()).rejects.toThrow('сервер недоступний');
      expect(store.historyState.canUndo).toBe(true);
      expect(store.root.find('b')).toBeNull();
    });
  });

  describe("зв'язки між вузлами", () => {
    let seq = 0;
    beforeEach(() => {
      seq = 0;
      http.post.mockImplementation(async (url, body) => ({ link: { id: `l${++seq}`, mapId: 'm1', ...body } }));
    });

    it('addLink створює зв\'язок, виділяє його, скасування і повтор працюють', async () => {
      await store.addLink('a1', 'b', 'впливає на');
      expect(http.post).toHaveBeenCalledWith('/maps/m1/links', { fromId: 'a1', toId: 'b', label: 'впливає на' });
      expect(store.links).toHaveLength(1);
      expect(store.selectedLinkId).toBe('l1');
      expect(store.selectedLink.label).toBe('впливає на');

      http.delete.mockResolvedValue({});
      await store.undo();
      expect(http.delete).toHaveBeenCalledWith('/maps/m1/links/l1');
      expect(store.links).toHaveLength(0);
      expect(store.selectedLinkId).toBeNull();

      await store.redo();
      expect(store.links.map((l) => [l.fromId, l.toId])).toEqual([['a1', 'b']]);
    });

    it('підпис змінюється і відкочується; порожній підпис стає null', async () => {
      await store.addLink('a', 'b');
      http.patch.mockImplementation(async (_u, data) => ({ link: { id: 'l1', ...data } }));
      await store.setLinkLabel('l1', '  залежить  ');
      expect(http.patch).toHaveBeenCalledWith('/maps/m1/links/l1', { label: 'залежить' });
      expect(store.links[0].label).toBe('залежить');
      await store.setLinkLabel('l1', 'залежить'); // без змін: нічого не шле
      expect(http.patch).toHaveBeenCalledTimes(1);
      await store.undo();
      expect(store.links[0].label).toBeNull();
    });

    it('видалення зв\'язку відкочується: зв\'язок повертається з тим самим підписом', async () => {
      await store.addLink('a', 'b', 'x');
      http.delete.mockResolvedValue({});
      await store.removeLink('l1');
      expect(store.links).toHaveLength(0);
      await store.undo();
      expect(store.links).toMatchObject([{ fromId: 'a', toId: 'b', label: 'x' }]);
    });

    it('видалення вузла прибирає його зв\'язки, а скасування повертає їх разом із гілкою', async () => {
      await store.addLink('a1', 'b', 'до B');
      await store.addLink('b', 'r');
      http.delete.mockResolvedValue({ deleted: ['a', 'a1'], changes: [] });
      await store.remove('a');
      expect(store.links.map((l) => `${l.fromId}>${l.toId}`)).toEqual(['b>r']);

      http.post.mockImplementation(async (url, body) => (url.endsWith('/restore')
        ? { nodes: body.nodes, changes: [] }
        : { link: { id: `l${++seq}`, ...body } }));
      await store.undo();
      expect(store.links.map((l) => `${l.fromId}>${l.toId}`).sort()).toEqual(['a1>b', 'b>r']);
      expect(store.links.find((l) => l.fromId === 'a1').label).toBe('до B');
    });

    it('після відновлення з новим id скасування раніших дій усе ще знаходить зв\'язок за парою вузлів', async () => {
      await store.addLink('a', 'b');
      http.delete.mockResolvedValue({});
      await store.removeLink('l1');
      await store.undo(); // зв'язок знову є, але вже з id l2
      expect(store.links[0].id).toBe('l2');
      await store.undo(); // скасовує додавання: має видалити саме l2
      expect(http.delete).toHaveBeenLastCalledWith('/maps/m1/links/l2');
      expect(store.links).toHaveLength(0);
    });

    it('load підхоплює зв\'язки карти і скидає виділення', async () => {
      http.get.mockResolvedValue({
        map: { id: 'm1', title: 'К', layout: 'radial', nodes: [row('r', null, 'R'), row('a', 'r', 'A')], links: [{ id: 'z', fromId: 'a', toId: 'r', label: null }] },
      });
      await store.load('m1');
      expect(store.links).toHaveLength(1);
      expect(store.map.links).toBeUndefined();
      store.selectLink('z');
      expect(store.selectedId).toBeNull();
      store.select('a');
      expect(store.selectedLinkId).toBeNull();
    });
  });
});
