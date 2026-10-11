import { describe, expect, it } from 'vitest';
import { centerOf, edgePath } from './geometry.js';
import { MAX_SCALE, MIN_SCALE, fitTransform, panBy, zoomAt } from './viewport.js';

const rect = (x, y, width = 100, height = 40) => ({ x, y, width, height });

describe('edgePath', () => {
  it('дитина праворуч: від правого краю батька до лівого краю дитини', () => {
    expect(edgePath(rect(0, 0), rect(200, 100))).toBe('M100 20C150 20 150 120 200 120');
  });

  it('дитина ліворуч: від лівого краю батька до правого краю дитини', () => {
    expect(edgePath(rect(300, 0), rect(100, 100))).toBe('M300 20C250 20 250 120 200 120');
  });

  it('дитина під батьком (перекриваються за x): знизу вгору', () => {
    expect(edgePath(rect(0, 0), rect(20, 200))).toBe('M50 40C50 120 70 120 70 200');
  });

  it('дитина над батьком: зверху вниз', () => {
    expect(edgePath(rect(0, 200), rect(20, 0))).toBe('M50 200C50 120 70 120 70 40');
  });

  it('рядок шляху дійсний для SVG: тільки M, C, числа і пробіли', () => {
    expect(edgePath(rect(0.123, 0.456), rect(333.333, 77.777))).toMatch(/^M[-\d. ]+C[-\d. ]+$/);
  });

  it('centerOf повертає середину прямокутника', () => {
    expect(centerOf(rect(10, 20, 100, 40))).toEqual({ x: 60, y: 40 });
  });
});

describe('viewport', () => {
  it('fitTransform вписує карту у вікно по центру', () => {
    const t = fitTransform({ width: 1000, height: 500 }, { width: 500, height: 400 }, 0);
    expect(t.scale).toBeCloseTo(0.5, 6);
    expect(t.tx).toBeCloseTo(0, 6);
    expect(t.ty).toBeCloseTo((400 - 500 * 0.5) / 2, 6);
  });

  it('маленьку карту не збільшує більш ніж у 1.2 раза', () => {
    const t = fitTransform({ width: 50, height: 50 }, { width: 1000, height: 1000 });
    expect(t.scale).toBeCloseTo(1.2, 6);
  });

  it('нульові розміри не ламають розрахунок', () => {
    const t = fitTransform({ width: 0, height: 0 }, { width: 0, height: 0 });
    expect(Number.isFinite(t.scale) && Number.isFinite(t.tx) && Number.isFinite(t.ty)).toBe(true);
  });

  it('zoomAt лишає точку під курсором на місці', () => {
    const t = { scale: 1, tx: 30, ty: 40 };
    const point = { x: 200, y: 150 };
    const world = { x: (point.x - t.tx) / t.scale, y: (point.y - t.ty) / t.scale };
    const z = zoomAt(t, point, 1.5);
    expect(world.x * z.scale + z.tx).toBeCloseTo(point.x, 6);
    expect(world.y * z.scale + z.ty).toBeCloseTo(point.y, 6);
  });

  it('масштаб обмежений зверху і знизу', () => {
    let t = { scale: 1, tx: 0, ty: 0 };
    for (let i = 0; i < 50; i += 1) t = zoomAt(t, { x: 0, y: 0 }, 2);
    expect(t.scale).toBe(MAX_SCALE);
    for (let i = 0; i < 100; i += 1) t = zoomAt(t, { x: 0, y: 0 }, 0.5);
    expect(t.scale).toBe(MIN_SCALE);
  });

  it('panBy зсуває, не змінюючи масштаб', () => {
    expect(panBy({ scale: 2, tx: 1, ty: 2 }, 10, -5)).toEqual({ scale: 2, tx: 11, ty: -3 });
  });
});
