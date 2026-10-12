import { describe, expect, it } from 'vitest';
import { TreeNode } from '../TreeNode.js';
import { DEFAULT_LAYOUT, LAYOUT_NAMES, LAYOUTS, LayoutContext, getLayoutStrategy } from './index.js';
import { displayText, labelFor, measureNode } from './measure.js';
import { visibleNodes } from './shared.js';

// Корінь із n дітьми; кожна i-та дитина має i % 4 онуків
function makeTree(n, text = 'Ідея') {
  const root = new TreeNode({ id: 'root', text: 'Корінь проєкту' });
  for (let i = 0; i < n; i += 1) {
    const child = root.add(new TreeNode({ id: `c${i}`, text: `${text} ${i}` }));
    for (let j = 0; j < i % 4; j += 1) {
      child.add(new TreeNode({ id: `c${i}-${j}`, text: `Підпункт ${j}` }));
    }
  }
  return root;
}

const overlap = (a, b, gap = 0) =>
  a.x < b.x + b.width + gap && b.x < a.x + a.width + gap &&
  a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;

function overlappingPairs(rects) {
  const list = [...rects.entries()];
  const bad = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (overlap(list[i][1], list[j][1])) bad.push([list[i][0], list[j][0]]);
    }
  }
  return bad;
}

describe.each(LAYOUT_NAMES)('розкладка «%s»', (name) => {
  it.each([0, 1, 3, 8, 24])('дає прямокутник кожному видимому вузлу без перетинів (%i дітей)', (n) => {
    const root = makeTree(n);
    const { rects } = new LayoutContext(name).compute(root);
    const visible = [...visibleNodes(root)];
    expect(rects.size).toBe(visible.length);
    for (const node of visible) expect(rects.has(node.id)).toBe(true);
    expect(overlappingPairs(rects)).toEqual([]);
  });

  it('не розкладає нащадків згорнутої гілки', () => {
    const root = makeTree(4);
    root.find('c3').collapsed = true;
    const { rects } = new LayoutContext(name).compute(root);
    expect(rects.has('c3')).toBe(true);
    expect(rects.has('c3-0')).toBe(false);
    expect(rects.size).toBe([...visibleNodes(root)].length);
  });

  it('після нормалізації всі координати додатні, а bounds охоплюють карту', () => {
    const ctx = new LayoutContext(name, { padding: 40 });
    const { rects, bounds } = ctx.compute(makeTree(10));
    for (const r of rects.values()) {
      expect(r.x).toBeGreaterThanOrEqual(40 - 1e-9);
      expect(r.y).toBeGreaterThanOrEqual(40 - 1e-9);
      expect(r.x + r.width).toBeLessThanOrEqual(bounds.width - 40 + 1e-9);
      expect(r.y + r.height).toBeLessThanOrEqual(bounds.height - 40 + 1e-9);
    }
  });

  it('карта з одного кореня теж розкладається', () => {
    const root = new TreeNode({ id: 'root', text: 'Сам' });
    const { rects, bounds } = new LayoutContext(name).compute(root);
    expect(rects.size).toBe(1);
    expect(bounds.width).toBeGreaterThan(0);
  });
});

describe('розкладка «tree»', () => {
  it('діти правіше батька, а батько по центру між першою й останньою дитиною', () => {
    const root = makeTree(5);
    const rects = LAYOUTS.tree.compute(root);
    const parent = rects.get('c3');
    for (const kid of root.find('c3').children) {
      expect(rects.get(kid.id).x).toBeGreaterThan(parent.x + parent.width);
    }
    const first = rects.get('c3-0');
    const last = rects.get('c3-2');
    const mid = (first.y + first.height / 2 + last.y + last.height / 2) / 2;
    expect(parent.y + parent.height / 2).toBeCloseTo(mid, 6);
  });

  it('вузли однієї глибини стоять в одному стовпці', () => {
    const rects = LAYOUTS.tree.compute(makeTree(6));
    const xs = new Set([0, 1, 2, 3, 4, 5].map((i) => rects.get(`c${i}`).x));
    expect(xs.size).toBe(1);
  });
});

describe('розкладка «bilateral»', () => {
  it('корінь у центрі, чотири рівні дитини ділять боки порівну', () => {
    const root = new TreeNode({ id: 'root', text: 'Центр' });
    for (let i = 0; i < 4; i += 1) root.add(new TreeNode({ id: `k${i}`, text: `K${i}` }));
    const rects = LAYOUTS.bilateral.compute(root);
    const rootRect = rects.get('root');
    expect(rootRect.x + rootRect.width / 2).toBeCloseTo(0, 6);
    expect(rootRect.y + rootRect.height / 2).toBeCloseTo(0, 6);
    const right = [0, 1, 2, 3].filter((i) => rects.get(`k${i}`).x > rootRect.x + rootRect.width);
    const left = [0, 1, 2, 3].filter((i) => rects.get(`k${i}`).x + rects.get(`k${i}`).width < rootRect.x);
    expect(right).toHaveLength(2);
    expect(left).toHaveLength(2);
  });

  it('одна дитина йде вправо, ліва половина порожня', () => {
    const root = new TreeNode({ id: 'root', text: 'Центр' });
    root.add(new TreeNode({ id: 'only', text: 'Єдина' }));
    const rects = LAYOUTS.bilateral.compute(root);
    expect(rects.get('only').x).toBeGreaterThan(rects.get('root').x);
  });

  it('піддерево лівого боку дзеркальне: онуки лівіше за дітей', () => {
    const root = makeTree(4);
    const rects = LAYOUTS.bilateral.compute(root);
    const rootRect = rects.get('root');
    const leftKids = [...root.children].filter((c) => rects.get(c.id).x < rootRect.x);
    expect(leftKids.length).toBeGreaterThan(0);
    for (const kid of leftKids) {
      for (const grand of kid.children) {
        expect(rects.get(grand.id).x + rects.get(grand.id).width).toBeLessThan(rects.get(kid.id).x);
      }
    }
  });
});

describe('розкладка «radial»', () => {
  it('корінь у початку координат, вузли однієї глибини на одному кільці', () => {
    const root = makeTree(7);
    const rects = LAYOUTS.radial.compute(root);
    const center = (id) => {
      const r = rects.get(id);
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    expect(center('root').x).toBeCloseTo(0, 6);
    expect(center('root').y).toBeCloseTo(0, 6);
    const radii = [0, 1, 2, 3, 4, 5, 6].map((i) => Math.hypot(center(`c${i}`).x, center(`c${i}`).y));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6);
    // онуки далі від центру за дітей
    expect(Math.hypot(center('c3-0').x, center('c3-0').y)).toBeGreaterThan(radii[3]);
  });

  it('перша гілка дивиться угору', () => {
    const root = makeTree(4);
    const rects = LAYOUTS.radial.compute(root);
    const first = rects.get('c0');
    expect(first.y + first.height / 2).toBeLessThan(0);
    expect(first.x + first.width / 2).toBeCloseTo(0, 6);
  });
});

describe('LayoutContext (контекст патерна Strategy)', () => {
  it('переключає стратегію на льоту, і результати різні', () => {
    const root = makeTree(6);
    const ctx = new LayoutContext('tree');
    const asTree = ctx.compute(root);
    ctx.use('radial');
    expect(ctx.name).toBe('radial');
    const asRadial = ctx.compute(root);
    expect(asRadial.bounds).not.toEqual(asTree.bounds);
  });

  it('невідома назва дає розкладку за замовчуванням', () => {
    expect(getLayoutStrategy('spiral').name).toBe(DEFAULT_LAYOUT);
    expect(new LayoutContext('nope').name).toBe(DEFAULT_LAYOUT);
  });

  it('набір розкладок збігається з тими, що приймає сервер', () => {
    expect([...LAYOUT_NAMES].sort()).toEqual(['bilateral', 'radial', 'tree']);
  });
});

describe('вимірювання вузлів', () => {
  it('довший текст дає ширший вузол, але не ширше межі', () => {
    const short = measureNode(new TreeNode({ id: 'a', text: 'Hi' }).add(new TreeNode({ id: 'b', text: 'Hi' })));
    const long = measureNode(new TreeNode({ id: 'c' }).add(new TreeNode({ id: 'd', text: 'x'.repeat(500) })));
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.width).toBeLessThanOrEqual(240);
  });

  it('порожній текст отримує підпис, а довгий обрізається з «…»', () => {
    const parent = new TreeNode({ id: 'p', text: 'P' });
    const empty = parent.add(new TreeNode({ id: 'e', text: '   ' }));
    expect(displayText(empty)).toBe('без тексту');
    const long = parent.add(new TreeNode({ id: 'l', text: 'я'.repeat(300) }));
    const label = labelFor(long, measureNode(long).width);
    expect(label.endsWith('…')).toBe(true);
    expect([...label].length).toBeLessThan(40);
  });
});

describe('підпис вузла', () => {
  it('текст, що вміщується в обмеження ширини, ніколи не обрізається', () => {
    for (let length = 1; length <= 40; length += 1) {
      const root = new TreeNode({ id: 'r', text: 'к'.repeat(length) });
      const kid = root.add(new TreeNode({ id: 'k', text: 'к'.repeat(length) }));
      for (const node of [root, kid]) {
        const { width } = measureNode(node);
        if (width < 240) expect(labelFor(node, width)).toBe('к'.repeat(length));
      }
    }
  });
});

describe('значок категорії і розмір вузла', () => {
  it('значок категорії розширює вузол на своє місце, а підпис при цьому не губиться', async () => {
    const { TreeNode } = await import('../TreeNode.js');
    const { measureNode, labelFor } = await import('./measure.js');
    const { CATEGORY_INSET } = await import('../marks.js');
    const plain = new TreeNode({ id: 'p', text: 'Дванадцять!' });
    const marked = new TreeNode({ id: 'm', text: 'Дванадцять!', category: 'idea' });
    expect(measureNode(marked).width - measureNode(plain).width).toBe(CATEGORY_INSET);
    expect(labelFor(marked, measureNode(marked).width)).toBe('Дванадцять!');
  });
});
