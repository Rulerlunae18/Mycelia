import { describe, expect, it } from 'vitest';
import { dropTarget } from './dragdrop';
import { TreeNode } from './TreeNode';

// root ─ a (a1, a2) ─ b
function build() {
  const root = new TreeNode({ id: 'root' });
  const a = root.add(new TreeNode({ id: 'a' }));
  const b = root.add(new TreeNode({ id: 'b' }));
  a.add(new TreeNode({ id: 'a1' }));
  a.add(new TreeNode({ id: 'a2' }));
  const rects = new Map([
    ['root', { x: 0, y: 0, width: 100, height: 40 }],
    ['a', { x: 200, y: 0, width: 100, height: 40 }],
    ['b', { x: 200, y: 100, width: 100, height: 40 }],
    ['a1', { x: 400, y: 0, width: 100, height: 40 }],
    ['a2', { x: 400, y: 100, width: 100, height: 40 }],
  ]);
  return { root, rects };
}
const at = (id, rects, fx, fy) => {
  const r = rects.get(id);
  return { x: r.x + r.width * fx, y: r.y + r.height * fy };
};

describe('dropTarget', () => {
  it('середина вузла: стає останньою дитиною', () => {
    const { root, rects } = build();
    expect(dropTarget(root, rects, 'b', at('a', rects, 0.5, 0.5))).toEqual({
      parentId: 'a', index: 2, kind: 'child', targetId: 'a',
    });
  });

  it('верхній край: ставить перед ціллю, нижній: після', () => {
    const { root, rects } = build();
    expect(dropTarget(root, rects, 'b', at('a1', rects, 0.5, 0.05))).toMatchObject({ parentId: 'a', index: 0, kind: 'before' });
    expect(dropTarget(root, rects, 'b', at('a1', rects, 0.5, 0.95))).toMatchObject({ parentId: 'a', index: 1, kind: 'after' });
  });

  it('у розкладці «дерево» край рахується по горизонталі', () => {
    const { root, rects } = build();
    const res = dropTarget(root, rects, 'b', at('a1', rects, 0.05, 0.5), { axis: 'x' });
    expect(res).toMatchObject({ parentId: 'a', index: 0, kind: 'before' });
  });

  it('зміна порядку серед своїх сусідів враховує, що сам вузол прибирається', () => {
    const { root, rects } = build();
    // a1 після a2: серед сусідів без a1 це індекс 1
    expect(dropTarget(root, rects, 'a1', at('a2', rects, 0.5, 0.95))).toMatchObject({ parentId: 'a', index: 1 });
  });

  it('на корінь можна лише скинути як на батька, сусідом кореня не стати', () => {
    const { root, rects } = build();
    expect(dropTarget(root, rects, 'a1', at('root', rects, 0.5, 0.05))).toMatchObject({ parentId: 'root', kind: 'child' });
  });

  it('нічого не змінюється: null (те саме місце, порожнє місце, корінь)', () => {
    const { root, rects } = build();
    expect(dropTarget(root, rects, 'a1', at('a2', rects, 0.5, 0.05))).toBeNull(); // вже перед a2
    // кинути на власного батька означає «в кінець», це справжня зміна
    expect(dropTarget(root, rects, 'a1', at('a', rects, 0.5, 0.5))).toMatchObject({ parentId: 'a', index: 1 });
    // а якщо вузол уже останній, змін немає
    expect(dropTarget(root, rects, 'a2', at('a', rects, 0.5, 0.5))).toBeNull();
  });

  it('не можна кинути на себе чи у власне піддерево', () => {
    const { root, rects } = build();
    expect(dropTarget(root, rects, 'a', at('a', rects, 0.5, 0.5))).toBeNull();
    expect(dropTarget(root, rects, 'a', at('a1', rects, 0.5, 0.5))).toBeNull();
  });

  it('порожнє місце і перетягування кореня дають null', () => {
    const { root, rects } = build();
    expect(dropTarget(root, rects, 'b', { x: 999, y: 999 })).toBeNull();
    expect(dropTarget(root, rects, 'root', at('a', rects, 0.5, 0.5))).toBeNull();
  });
});
