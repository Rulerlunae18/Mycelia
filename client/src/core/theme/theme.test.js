import { describe, expect, it } from 'vitest';
import { CATEGORIES, PRIORITIES } from '../marks';
import { contrastRatio } from './contrast';
import { DEFAULT_THEME, getTheme, THEME_NAMES, THEMES, ThemeFactory } from './index';

describe('Abstract Factory: теми', () => {
  it('усі теми є фабриками й створюють ту саму родину продуктів', () => {
    expect(THEME_NAMES).toEqual(['forest', 'paper', 'ocean']);
    for (const t of Object.values(THEMES)) {
      expect(t).toBeInstanceOf(ThemeFactory);
      expect(Object.keys(t.createNodeStyle())).toEqual(['fill', 'stroke', 'strokeWidth', 'textColor', 'fontSize', 'fontWeight']);
      expect(Object.keys(t.createEdgeStyle(1))).toEqual(['stroke', 'width', 'opacity']);
      expect(Object.keys(t.createMarkStyle('category', 'idea'))).toEqual(['fill', 'ink']);
      expect(Object.keys(t.createBoundaryStyle(0))).toEqual(['stroke', 'fill', 'labelColor']);
      expect(Object.keys(t.createCanvasStyle())).toEqual(['background', 'dot', 'accent', 'ink']);
    }
  });

  it('теми справді різні, а невідома назва дає тему за замовчуванням', () => {
    expect(getTheme('paper').createCanvasStyle().background).not.toBe(getTheme('forest').createCanvasStyle().background);
    expect(getTheme('default').name).toBe(DEFAULT_THEME);
    expect(getTheme(undefined).name).toBe(DEFAULT_THEME);
  });

  it('абстрактна фабрика сама нічого не створює', () => {
    expect(() => new ThemeFactory().createNodeStyle()).toThrow();
  });

  it('текст читається (контраст ≥ 4.5) на вузлах, корені, значках і лініях видно на полотні', () => {
    for (const t of Object.values(THEMES)) {
      for (const isRoot of [false, true]) {
        for (const selected of [false, true]) {
          const s = t.createNodeStyle({ isRoot, selected });
          expect(contrastRatio(s.textColor, s.fill), `${t.name} root=${isRoot}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const c of CATEGORIES) {
        const m = t.createMarkStyle('category', c.key);
        expect(contrastRatio(m.ink, m.fill), `${t.name} ${c.key}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const p of PRIORITIES) {
        const m = t.createMarkStyle('priority', p.key);
        expect(contrastRatio(m.ink, m.fill), `${t.name} ${p.key}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('підпис області помітний на полотні (контраст ≥ 3, великий жирний текст)', () => {
    for (const t of Object.values(THEMES)) {
      const bg = t.createCanvasStyle().background;
      for (let i = 0; i < 6; i++) {
        expect(contrastRatio(t.createBoundaryStyle(i).labelColor, bg), `${t.name} #${i}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('значки різних категорій і рівнів терміновості відрізняються кольором', () => {
    for (const t of Object.values(THEMES)) {
      expect(new Set(CATEGORIES.map((c) => t.createMarkStyle('category', c.key).fill)).size).toBe(CATEGORIES.length);
      expect(new Set(PRIORITIES.map((p) => t.createMarkStyle('priority', p.key).fill)).size).toBe(PRIORITIES.length);
    }
  });
});
