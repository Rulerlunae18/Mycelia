import { describe, expect, it } from 'vitest';
import { boundaryOutline, convexHull, roundedPath } from './boundary';

describe('convexHull', () => {
  it('залишає лише зовнішні точки', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 }, { x: 5, y: 0 }];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 5, y: 5 });
  });

  it('точки на одній прямій дають лише крайні', () => {
    const hull = convexHull([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]);
    expect(hull.length).toBeLessThanOrEqual(2);
  });
});

describe('boundaryOutline', () => {
  const rect = (x, y, w = 80, h = 36) => ({ x, y, width: w, height: h });

  it('для одного вузла дає закритий скруглений контур навколо нього з відступом', () => {
    const { path, labelAt } = boundaryOutline([rect(100, 100)], { pad: 16, radius: 20 });
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path.match(/Q/g)).toHaveLength(4);
    expect(labelAt.y).toBeLessThan(100 - 16); // підпис над контуром
    expect(labelAt.x).toBeGreaterThanOrEqual(100 - 16);
  });

  it('охоплює всі вузли: усі кути вузлів лежать у межах контуру', () => {
    const rects = [rect(0, 0), rect(200, 120), rect(40, 260)];
    const { path } = boundaryOutline(rects, { pad: 10, radius: 12 });
    const nums = path.match(/-?\d+(\.\d+)?/g).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeLessThanOrEqual(0);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(280);
    expect(Math.min(...ys)).toBeLessThanOrEqual(0);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(296);
  });

  it('без вузлів повертає null', () => {
    expect(boundaryOutline([])).toBeNull();
  });

  it('скруглення не перевищує половини сторони, навіть для малих фігур', () => {
    const path = roundedPath([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], 50);
    expect(path).toContain('Q');
    expect(path).not.toContain('NaN');
  });
});
