import { describe, expect, it } from 'vitest';
import { TreeNode } from './TreeNode.js';

function sample() {
  const root = new TreeNode({ id: 'root', text: 'Проєкт' });
  const a = root.add(new TreeNode({ id: 'a', text: 'A' }));
  const b = root.add(new TreeNode({ id: 'b', text: 'B' }));
  const a1 = a.add(new TreeNode({ id: 'a1', text: 'A1' }));
  const a2 = a.add(new TreeNode({ id: 'a2', text: 'A2' }));
  return { root, a, b, a1, a2 };
}

describe('TreeNode (Composite)', () => {
  it('рахує розмір піддерева однаково для листа і гілки', () => {
    const { root, a, b } = sample();
    expect(root.size()).toBe(5);
    expect(a.size()).toBe(3);
    expect(b.size()).toBe(1);
    expect(b.isLeaf).toBe(true);
  });

  it('обходить дерево в глибину спершу вузол', () => {
    const { root } = sample();
    expect([...root.walk()].map((n) => n.id)).toEqual(['root', 'a', 'a1', 'a2', 'b']);
  });

  it('обчислює глибину і шукає вузол за id', () => {
    const { root, a2 } = sample();
    expect(a2.depth).toBe(2);
    expect(root.find('a2')).toBe(a2);
    expect(root.find('nope')).toBeNull();
  });

  it('переміщує вузол разом із піддеревом', () => {
    const { root, a, b, a1 } = sample();
    a.moveTo(b);
    expect(root.children).toEqual([b]);
    expect(b.children).toEqual([a]);
    expect(a1.depth).toBe(3);
    expect(root.size()).toBe(5);
  });

  it('вставляє дитину за індексом', () => {
    const { root, a, b } = sample();
    const c = new TreeNode({ id: 'c' });
    root.add(c, 1);
    expect(root.children).toEqual([a, c, b]);
  });

  it('забороняє цикли і переміщення кореня', () => {
    const { root, a, a1 } = sample();
    expect(() => a1.add(a)).toThrow();
    expect(() => a.add(a)).toThrow();
    expect(() => root.moveTo(a)).toThrow();
  });

  it('видалення вузла забирає і його піддерево', () => {
    const { root, a } = sample();
    expect(root.remove(a)).toBe(true);
    expect(root.size()).toBe(2);
    expect(a.parent).toBeNull();
    expect(root.remove(a)).toBe(false);
  });

  it('visibleSize не рахує нащадків згорнутої гілки', () => {
    const { root, a } = sample();
    expect(root.visibleSize()).toBe(5);
    a.toggle();
    expect(root.visibleSize()).toBe(3);
    a.toggle();
    expect(root.visibleSize()).toBe(5);
  });

  it('будує дерево з плоского списку рядків БД', () => {
    const rows = [
      { id: 'a1', parentId: 'a', text: 'A1', order: 0 },
      { id: 'root', parentId: null, text: 'Корінь', order: 0 },
      { id: 'b', parentId: 'root', text: 'B', order: 1 },
      { id: 'a', parentId: 'root', text: 'A', order: 0 },
    ];
    const root = TreeNode.fromFlat(rows);
    expect(root.id).toBe('root');
    expect(root.children.map((n) => n.id)).toEqual(['a', 'b']);
    expect(root.find('a1').depth).toBe(2);
  });
});
