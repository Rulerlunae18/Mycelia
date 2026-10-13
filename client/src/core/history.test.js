import { describe, expect, it, vi } from 'vitest';
import { History } from './history';

// Проста команда над масивом: додати значення в кінець
const push = (log, value) => ({
  label: `додати ${value}`,
  do: async () => { log.push(value); },
  undo: async () => { log.pop(); },
});

describe('History (Command)', () => {
  it('виконує, скасовує і повторює дії', async () => {
    const log = [];
    const h = new History();
    await h.execute(push(log, 1));
    await h.execute(push(log, 2));
    expect(log).toEqual([1, 2]);
    expect([h.canUndo, h.canRedo]).toEqual([true, false]);

    await h.undo();
    expect(log).toEqual([1]);
    expect(h.canRedo).toBe(true);
    await h.redo();
    expect(log).toEqual([1, 2]);
    await h.undo(); await h.undo();
    expect(log).toEqual([]);
    expect(h.canUndo).toBe(false);
    expect(await h.undo()).toBeNull(); // скасовувати нічого: не помилка
    expect(await h.redo()).not.toBeNull();
  });

  it('нова дія очищає «повтор»', async () => {
    const log = [];
    const h = new History();
    await h.execute(push(log, 1));
    await h.undo();
    await h.execute(push(log, 2));
    expect(h.canRedo).toBe(false);
    expect(log).toEqual([2]);
  });

  it('підписи наступних дій для кнопок', async () => {
    const h = new History();
    expect([h.undoLabel, h.redoLabel]).toEqual(['', '']);
    await h.execute(push([], 7));
    expect(h.undoLabel).toBe('додати 7');
    await h.undo();
    expect([h.undoLabel, h.redoLabel]).toEqual(['', 'додати 7']);
  });

  it('використовує redo() команди, якщо вона є, інакше повторює do()', async () => {
    const calls = [];
    const h = new History();
    await h.execute({ label: 'x', do: async () => calls.push('do'), undo: async () => calls.push('undo'), redo: async () => calls.push('redo') });
    await h.undo();
    await h.redo();
    expect(calls).toEqual(['do', 'undo', 'redo']);
  });

  it('якщо дія впала, стеки лишаються як були, а наступні дії працюють', async () => {
    const log = [];
    const h = new History();
    await h.execute(push(log, 1));
    await expect(h.execute({ label: 'bad', do: async () => { throw new Error('boom'); }, undo: async () => {} })).rejects.toThrow('boom');
    expect(h.undoLabel).toBe('додати 1');

    const failingUndo = { label: 'fu', do: async () => {}, undo: async () => { throw new Error('no undo'); } };
    await h.execute(failingUndo);
    await expect(h.undo()).rejects.toThrow('no undo');
    expect(h.undoLabel).toBe('fu'); // команда не втрачена
    expect(h.canRedo).toBe(false);
    await h.execute(push(log, 2)); // черга не заблокована
    expect(log).toEqual([1, 2]);
  });

  it('швидкі виклики виконуються по черзі, в порядку надходження', async () => {
    const order = [];
    const slow = (name, ms) => ({
      label: name,
      do: () => new Promise((r) => setTimeout(() => { order.push(`${name}+`); r(); }, ms)),
      undo: () => new Promise((r) => setTimeout(() => { order.push(`${name}-`); r(); }, ms)),
    });
    const h = new History();
    await Promise.all([h.execute(slow('a', 30)), h.execute(slow('b', 1))]);
    await Promise.all([h.undo(), h.undo()]);
    expect(order).toEqual(['a+', 'b+', 'b-', 'a-']);
  });

  it('обмежує глибину історії і викликає onChange', async () => {
    const onChange = vi.fn();
    const h = new History({ limit: 2, onChange });
    for (let i = 0; i < 5; i++) await h.execute(push([], i));
    expect(onChange).toHaveBeenCalledTimes(5);
    let undone = 0;
    while (await h.undo()) undone += 1;
    expect(undone).toBe(2);
    h.clear();
    expect(h.canUndo || h.canRedo).toBe(false);
  });

  it('команда може влитися в попередню: у стек не потрапляє, одне скасування відкочує обидві дії', async () => {
    const log = [];
    const h = new History();
    const first = { ...push(log, 'a'), kind: 'add' };
    await h.execute(first);
    const merging = {
      label: 'ім\'я',
      do: async () => { log.push('ім\'я'); },
      undo: async () => { throw new Error('має відкочуватись першою командою'); },
      mergeInto: (top) => top === first,
    };
    await h.execute(merging);
    expect(h.undoLabel).toBe('додати a'); // лише одна команда в стеку
    await h.undo();
    expect(log).toEqual(['a']); // undo першої команди (pop) знімає останній запис
  });

  it('команда, яка не влилась, потрапляє в стек як зазвичай', async () => {
    const h = new History();
    await h.execute({ label: 'x', do: async () => {}, undo: async () => {} });
    await h.execute({ label: 'y', do: async () => {}, undo: async () => {}, mergeInto: () => false });
    expect(h.undoLabel).toBe('y');
  });
});
