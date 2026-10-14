import { describe, expect, it } from 'vitest';
import { asText, countNodes, materialize, snapshotBranch } from './clipboard.js';
import { TreeNode } from './TreeNode.js';

function branch() {
  const a = new TreeNode({ id: 'a', text: 'A', category: 'task', priority: 'high', note: 'опис', style: { color: 'red' } });
  const a1 = a.add(new TreeNode({ id: 'a1', text: 'A1' }));
  a.add(new TreeNode({ id: 'a2', text: 'A2', collapsed: true }));
  a1.add(new TreeNode({ id: 'a11', text: 'A11', note: 'глибоко' }));
  return a;
}

describe('буфер гілок', () => {
  it('знімок не містить id і зберігає властивості та порядок', () => {
    const snap = snapshotBranch(branch());
    expect(JSON.stringify(snap)).not.toContain('"id"');
    expect(snap).toMatchObject({ text: 'A', category: 'task', priority: 'high', note: 'опис', style: { color: 'red' } });
    expect(snap.children.map((c) => c.text)).toEqual(['A1', 'A2']);
    expect(snap.children[1].collapsed).toBe(true);
    expect(snap.children[0].children[0].note).toBe('глибоко');
    expect(countNodes(snap)).toBe(4);
  });

  it('вставка дає нові унікальні id, правильних батьків і порядок, батько завжди перед дітьми', () => {
    let n = 0;
    const rows = materialize(snapshotBranch(branch()), { parentId: 'P', index: 3, newId: () => `n${++n}` });
    expect(rows.map((r) => r.id)).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(rows[0]).toMatchObject({ id: 'n1', parentId: 'P', order: 3, text: 'A', note: 'опис' });
    expect(rows[1]).toMatchObject({ parentId: 'n1', order: 0, text: 'A1' });
    expect(rows[2]).toMatchObject({ parentId: 'n2', order: 0, text: 'A11', note: 'глибоко' });
    expect(rows[3]).toMatchObject({ parentId: 'n1', order: 1, text: 'A2', collapsed: true });
    const seen = new Set();
    for (const r of rows) {
      if (r.id !== 'n1') expect(seen.has(r.parentId)).toBe(true);
      seen.add(r.id);
    }
  });

  it('один знімок можна вставити двічі, і копії незалежні одна від одної та від знімка', () => {
    const snap = snapshotBranch(branch());
    const first = materialize(snap, { parentId: 'P', index: 0 });
    const second = materialize(snap, { parentId: 'P', index: 1 });
    expect(new Set([...first, ...second].map((r) => r.id)).size).toBe(8);
    first[0].style.color = 'blue';
    first[0].text = 'змінено';
    expect(second[0].style.color).toBe('red');
    expect(snap.style.color).toBe('red');
    expect(snap.text).toBe('A');
  });

  it('справжні id за замовчуванням: UUID', () => {
    const rows = materialize(snapshotBranch(branch()), { parentId: 'P', index: 0 });
    expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('текст для системного буфера: список гілки', () => {
    expect(asText(branch())).toBe('A\n- A1\n  - A11\n- A2\n');
  });
});
