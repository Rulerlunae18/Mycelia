import { describe, expect, it } from 'vitest';
import { buildPath, growNetwork, makeRng, pickRoute, pointAt } from './mycelium';

describe('грибниця', () => {
  it('однакове зерно дає однакову мережу', () => {
    const a = growNetwork({ width: 800, height: 600, seed: 3 });
    const b = growNetwork({ width: 800, height: 600, seed: 3 });
    expect(a).toEqual(b);
    expect(growNetwork({ width: 800, height: 600, seed: 4 })).not.toEqual(a);
  });

  it('усі зв\'язки коректні, а мережа не виходить далеко за екран і не перевищує ліміт', () => {
    const nodes = growNetwork({ width: 1200, height: 700, seed: 9, maxNodes: 900 });
    expect(nodes.length).toBeGreaterThan(100);
    expect(nodes.length).toBeLessThanOrEqual(900);
    nodes.forEach((n, i) => {
      expect(n.parent).toBeLessThan(i); // батько завжди створений раніше
      expect(n.x).toBeGreaterThan(-60);
      expect(n.x).toBeLessThan(1260);
      expect(n.y).toBeGreaterThan(-60);
      expect(n.y).toBeLessThan(760);
    });
  });

  it('листок не має дітей, а решта має', () => {
    const nodes = growNetwork({ width: 900, height: 600, seed: 5 });
    const parents = new Set(nodes.map((n) => n.parent));
    nodes.forEach((n, i) => expect(n.leaf).toBe(!parents.has(i)));
  });

  it('шлях іде від кореня до листка, довжина збігається з сумою відрізків', () => {
    const nodes = growNetwork({ width: 900, height: 600, seed: 5 });
    const route = pickRoute(nodes, makeRng(1), 150);
    expect(route).not.toBeNull();
    expect(route.length).toBeGreaterThanOrEqual(150);
    let sum = 0;
    for (let i = 1; i < route.points.length; i++) {
      sum += Math.hypot(route.points[i].x - route.points[i - 1].x, route.points[i].y - route.points[i - 1].y);
    }
    expect(route.length).toBeCloseTo(sum, 6);
  });

  it('pointAt повертає краї шляху і середину відрізка', () => {
    const nodes = [
      { x: 0, y: 0, parent: -1, gen: 0, leaf: false },
      { x: 10, y: 0, parent: 0, gen: 0, leaf: false },
      { x: 10, y: 10, parent: 1, gen: 0, leaf: true },
    ];
    const path = buildPath(nodes, 2);
    expect(path.length).toBe(20);
    expect(pointAt(path, -5)).toEqual({ x: 0, y: 0 });
    expect(pointAt(path, 99)).toEqual({ x: 10, y: 10 });
    expect(pointAt(path, 5)).toEqual({ x: 5, y: 0 });
    expect(pointAt(path, 15)).toEqual({ x: 10, y: 5 });
  });
});
