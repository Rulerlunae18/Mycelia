import { measureNode } from './measure.js';

export const DEFAULT_OPTIONS = {
  measure: measureNode,
  gapX: 56, // відстань між стовпцями (дерево) і кільцями (радіальна)
  gapY: 14, // відстань між вузлами по вертикалі
  padding: 40, // поле навколо всієї карти
};

// Діти, які реально малюються: у згорнутого вузла їх немає
export const visibleChildren = (node) => (node.collapsed ? [] : node.children);

// Усі видимі вузли в порядку обходу в глибину
export function* visibleNodes(root) {
  yield root;
  for (const child of visibleChildren(root)) yield* visibleNodes(child);
}

// Кількість листків видимого піддерева: вага вузла під час розподілу місця
export function visibleLeafCount(node) {
  const kids = visibleChildren(node);
  return kids.length ? kids.reduce((sum, c) => sum + visibleLeafCount(c), 0) : 1;
}

// Зсуває всі прямокутники так, щоб карта починалась з (padding, padding),
// і повертає розміри всього полотна.
export function normalize(rects, padding) {
  if (!rects.size) return { rects, bounds: { width: padding * 2, height: padding * 2 } };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects.values()) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  const dx = padding - minX;
  const dy = padding - minY;
  const shifted = new Map();
  for (const [id, r] of rects) shifted.set(id, { ...r, x: r.x + dx, y: r.y + dy });
  return {
    rects: shifted,
    bounds: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 },
  };
}
