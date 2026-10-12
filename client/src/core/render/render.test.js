import { describe, expect, it } from 'vitest';
import { TreeNode } from '../TreeNode.js';
import { LayoutContext } from '../layout/index.js';
import { MapRenderer } from './MapRenderer.js';
import { assertBackend } from './RenderBackend.js';
import { SvgSceneBackend } from './SvgSceneBackend.js';

// Мок-бекенд: просто записує виклики. Доводить, що рендерер працює
// з будь-яким бекендом, який виконує контракт, а не лише з SVG.
class RecordingBackend {
  calls = [];
  begin(bounds) { this.calls.push(['begin', bounds]); }
  drawEdge(e) { this.calls.push(['edge', e]); }
  drawNode(n) { this.calls.push(['node', n]); }
  end() { this.calls.push(['end']); return 'done'; }
}

function sample() {
  const root = new TreeNode({ id: 'r', text: 'Корінь' });
  const a = root.add(new TreeNode({ id: 'a', text: 'A', category: 'idea', priority: 'urgent' }));
  root.add(new TreeNode({ id: 'b', text: 'B' }));
  a.add(new TreeNode({ id: 'a1', text: 'A1' }));
  a.add(new TreeNode({ id: 'a2', text: 'A2' }));
  return { root, a };
}

describe('MapRenderer (Bridge)', () => {
  it('викликає бекенд у порядку begin, лінії, вузли, end і повертає його результат', () => {
    const backend = new RecordingBackend();
    const result = new MapRenderer(backend).render(sample().root);
    const kinds = backend.calls.map((c) => c[0]);
    expect(result).toBe('done');
    expect(kinds[0]).toBe('begin');
    expect(kinds.at(-1)).toBe('end');
    expect(kinds.filter((k) => k === 'edge')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'node')).toHaveLength(5);
    expect(kinds.lastIndexOf('edge')).toBeLessThan(kinds.indexOf('node'));
  });

  it('для кожного вузла крім кореня малює лінію від батька', () => {
    const backend = new RecordingBackend();
    new MapRenderer(backend).render(sample().root);
    const edges = backend.calls.filter((c) => c[0] === 'edge').map((c) => [c[1].fromId, c[1].toId]);
    expect(edges.sort()).toEqual([['a', 'a1'], ['a', 'a2'], ['r', 'a'], ['r', 'b']].sort());
    for (const [, e] of backend.calls.filter((c) => c[0] === 'edge')) {
      expect(e.path).toMatch(/^M[-\d. ]+C[-\d. ]+$/);
    }
  });

  it('передає бекенду прапорці вузла: корінь, виділення, категорію і терміновість', () => {
    const backend = new RecordingBackend();
    new MapRenderer(backend).render(sample().root, { selectedId: 'a' });
    const nodes = Object.fromEntries(backend.calls.filter((c) => c[0] === 'node').map((c) => [c[1].id, c[1]]));
    expect(nodes.r.isRoot).toBe(true);
    expect(nodes.a.selected).toBe(true);
    expect(nodes.b.selected).toBe(false);
    expect(nodes.a.category).toBe('idea');
    expect(nodes.a.priority).toBe('urgent');
    expect(nodes.b.priority).toBeNull();
  });

  it('згорнута гілка: нащадків не малює, а бекенду повідомляє, скільки приховано', () => {
    const { root, a } = sample();
    a.collapsed = true;
    const backend = new RecordingBackend();
    new MapRenderer(backend).render(root);
    const ids = backend.calls.filter((c) => c[0] === 'node').map((c) => c[1].id);
    expect(ids.sort()).toEqual(['a', 'b', 'r']);
    const folded = backend.calls.find((c) => c[0] === 'node' && c[1].id === 'a')[1];
    expect(folded.collapsed).toBe(true);
    expect(folded.hiddenCount).toBe(2);
    // згорнутий лист ніяких «+N» не показує
    const leaf = backend.calls.find((c) => c[0] === 'node' && c[1].id === 'b')[1];
    expect(leaf.collapsed).toBe(false);
    expect(leaf.hiddenCount).toBe(0);
  });

  it('бекенд міняється під час роботи, а розкладка вибирається параметром', () => {
    const { root } = sample();
    const renderer = new MapRenderer(new RecordingBackend(), new LayoutContext('tree'));
    const scene = new SvgSceneBackend();
    renderer.setBackend(scene);
    const asTree = renderer.render(root);
    const asRadial = renderer.render(root, { layout: 'radial' });
    expect(asTree.nodes).toHaveLength(5);
    expect(renderer.layout.name).toBe('radial');
    expect(asRadial.bounds).not.toEqual(asTree.bounds);
  });

  it('відхиляє бекенд, який не виконує контракт', () => {
    expect(() => new MapRenderer({ begin() {} })).toThrow(/drawEdge/);
    expect(() => assertBackend(null)).toThrow(TypeError);
  });
});

describe('SvgSceneBackend', () => {
  it('збирає сцену з bounds, лініями і вузлами, а текст не екранує сам (це робить Vue)', () => {
    const root = new TreeNode({ id: 'r', text: '<script>alert(1)</script>' });
    const scene = new MapRenderer(new SvgSceneBackend()).render(root);
    expect(scene.bounds.width).toBeGreaterThan(0);
    expect(scene.edges).toEqual([]);
    expect(scene.nodes).toHaveLength(1);
    // у сцені лежить звичайний рядок: у DOM він потрапляє через {{ }}, не через v-html
    expect(scene.nodes[0].text).toBe('<script>alert(1)</script>');
  });

  it('кожне нове малювання починає чисту сцену', () => {
    const backend = new SvgSceneBackend();
    const renderer = new MapRenderer(backend);
    const { root } = sample();
    renderer.render(root);
    const second = renderer.render(new TreeNode({ id: 'x', text: 'Один' }));
    expect(second.nodes).toHaveLength(1);
  });

  it('вузлу з категорією і терміновістю дає значки зі стилем з теми й місце під значок', () => {
    const { root } = sample();
    const scene = new MapRenderer(new SvgSceneBackend()).render(root, { theme: 'paper' });
    const a = scene.nodes.find((n) => n.id === 'a');
    const b = scene.nodes.find((n) => n.id === 'b');
    expect(a.marks.category).toMatchObject({ key: 'idea', glyph: '★' });
    expect(a.marks.priority).toMatchObject({ key: 'urgent', glyph: '!' });
    expect(a.marks.category.ink).toMatch(/^#/);
    expect(a.inset).toBeGreaterThan(0);
    expect(b.marks).toEqual({ category: null, priority: null });
    expect(b.inset).toBe(0);
    expect(scene.canvas.background).toBe('#f6f1e7');
  });

  it('тема змінює вигляд, а не розкладку: прямокутники ті самі', () => {
    const { root } = sample();
    const r = new MapRenderer(new SvgSceneBackend());
    const forest = r.render(root, { theme: 'forest' });
    const ocean = r.render(root, { theme: 'ocean' });
    expect(ocean.nodes.map((n) => n.rect)).toEqual(forest.nodes.map((n) => n.rect));
    expect(ocean.nodes[0].look.fill).not.toBe(forest.nodes[0].look.fill);
    expect(ocean.edges[0].look.stroke).not.toBe('');
  });

  it('виділений вузол отримує товстішу рамку', () => {
    const { root } = sample();
    const scene = new MapRenderer(new SvgSceneBackend()).render(root, { selectedId: 'b' });
    expect(scene.nodes.find((n) => n.id === 'b').look.strokeWidth).toBeGreaterThan(scene.nodes.find((n) => n.id === 'a').look.strokeWidth);
  });
});
