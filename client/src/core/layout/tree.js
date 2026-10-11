import { DEFAULT_OPTIONS, visibleChildren } from './shared.js';

// Розкладка «лісу» піддерев зліва направо: стовпець на кожну глибину,
// листки стоять рядками, батько посередині між першою і останньою дитиною.
// Її ж використовує двостороння розкладка для кожної половини карти.
export function layoutForest(roots, { measure, gapX, gapY }) {
  const sizes = new Map();
  const maxWidth = [];
  const collect = (node, depth) => {
    const size = measure(node);
    sizes.set(node.id, size);
    maxWidth[depth] = Math.max(maxWidth[depth] ?? 0, size.width);
    for (const child of visibleChildren(node)) collect(child, depth + 1);
  };
  roots.forEach((r) => collect(r, 0));

  const columnX = [];
  let x = 0;
  for (let d = 0; d < maxWidth.length; d += 1) {
    columnX[d] = x;
    x += maxWidth[d] + gapX;
  }

  const rects = new Map();
  let cursor = 0;
  const place = (node, depth) => {
    const { width, height } = sizes.get(node.id);
    const kids = visibleChildren(node);
    let centerY;
    if (!kids.length) {
      centerY = cursor + height / 2;
      cursor += height + gapY;
    } else {
      const ys = kids.map((k) => place(k, depth + 1));
      centerY = (ys[0] + ys[ys.length - 1]) / 2;
    }
    rects.set(node.id, { x: columnX[depth], y: centerY - height / 2, width, height });
    return centerY;
  };
  roots.forEach((r) => place(r, 0));

  return { rects, height: Math.max(0, cursor - gapY) };
}

// Стратегія «Дерево»: корінь ліворуч, гілки вправо.
export const treeLayout = {
  name: 'tree',
  label: 'Дерево',
  compute(root, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    return layoutForest([root], opts).rects;
  },
};
