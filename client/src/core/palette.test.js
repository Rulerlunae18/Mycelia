import { describe, expect, it } from 'vitest';
import { readPalette, toCommaRgb } from './palette.js';

describe('readPalette', () => {
  it('перетворює «R G B» зі змінних CSS на «R, G, B» для canvas', () => {
    expect(toCommaRgb(' 107 140  136 ')).toBe('107, 140, 136');
    const vars = { '--thread-rgb': '1 2 3', '--glow-rgb': '4 5 6', '--trail-rgb': '7 8 9', '--spark-rgb': '10 11 12' };
    expect(readPalette((n) => vars[n])).toEqual({ thread: '1, 2, 3', glow: '4, 5, 6', trail: '7, 8, 9', spark: '10, 11, 12' });
  });

  it('якщо змінної немає або вона зіпсована, дає колір за замовчуванням, а не поламаний canvas', () => {
    const palette = readPalette((n) => (n === '--glow-rgb' ? 'червоний' : ''));
    for (const value of Object.values(palette)) expect(value).toMatch(/^\d+, \d+, \d+$/);
  });
});
