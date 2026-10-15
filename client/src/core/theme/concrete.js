import { ThemeFactory } from './ThemeFactory.js';
import { BoundaryStyle, CanvasStyle, EdgeStyle, LinkStyle, MarkStyle, NodeStyle } from './products.js';
import { inkOn, withAlpha } from './contrast.js';

// Спільна реалізація «з палітри»: конкретна тема лише називає себе і дає палітру.
class PaletteTheme extends ThemeFactory {
  constructor(name, label, palette) {
    super();
    this._name = name;
    this._label = label;
    this.p = palette;
  }

  get name() { return this._name; }
  get label() { return this._label; }

  createNodeStyle({ isRoot = false, selected = false } = {}) {
    const { p } = this;
    return new NodeStyle({
      fill: isRoot ? p.accent : p.node,
      stroke: selected || isRoot ? p.accent : p.nodeBorder,
      strokeWidth: selected ? 3 : 1.5,
      textColor: isRoot ? p.accentInk : p.text,
      fontSize: isRoot ? 15 : 13,
      fontWeight: isRoot ? 700 : 400,
    });
  }

  createEdgeStyle(depth = 1) {
    return new EdgeStyle({ stroke: this.p.edge, width: Math.max(1.4, 3.2 - depth * 0.6), opacity: 0.55 });
  }

  createMarkStyle(kind, key) {
    const fill = this.p[kind]?.[key] ?? this.p.edge;
    return new MarkStyle({ fill, ink: inkOn(fill) });
  }

  // Кольори областей беремо з палітри значків теми, вони вже підібрані під її фон
  createBoundaryStyle(index = 0) {
    const colors = Object.values(this.p.category);
    const color = colors[index % colors.length];
    return new BoundaryStyle({ stroke: color, fill: withAlpha(color, 0.08), labelColor: color });
  }

  // Зв'язки відрізняються від гілок кольором (другий акцент теми) і штрихом, щоб не плутались з деревом
  createLinkStyle({ selected = false } = {}) {
    const { p } = this;
    return new LinkStyle({
      stroke: selected ? p.accent : p.link, width: selected ? 2.6 : 1.8,
      labelColor: p.text, labelBg: p.canvas, selectedStroke: p.accent,
    });
  }

  createCanvasStyle() {
    const { p } = this;
    return new CanvasStyle({ background: p.canvas, dot: p.dot, accent: p.accent, ink: p.text });
  }
}

const DARK_MARKS = {
  category: { idea: '#f4c95d', task: '#7ee0a4', question: '#7aa8ff', info: '#9fb4c7', risk: '#ff8a6b', decision: '#c79bff' },
  priority: { low: '#8fa89a', normal: '#7aa8ff', high: '#ffb454', urgent: '#ff6b6b' },
};
const LIGHT_MARKS = {
  category: { idea: '#b7791f', task: '#1f8a56', question: '#2f62d1', info: '#51697d', risk: '#c2410c', decision: '#7c3aed' },
  priority: { low: '#64748b', normal: '#2f62d1', high: '#b45309', urgent: '#c81e1e' },
};

// Родини: ягоди (за замовчуванням), ліс, папір світла, океан.
// «Ягоди»: темна листя-палітра з лавандовим світінням; зв'язки теплі, щоб виділялись на холодному тлі.
export const BerryTheme = new PaletteTheme('berry', 'Ягоди', {
  canvas: '#161d1a', dot: 'rgba(179, 162, 238, 0.11)', node: '#212d28', nodeBorder: '#3b4e45',
  text: '#e8f1f0', accent: '#b3a2ee', accentInk: '#15102a', edge: '#6b8c88', link: '#f0b87a', ...DARK_MARKS,
});

export const ForestTheme = new PaletteTheme('forest', 'Ліс', {
  canvas: '#16221c', dot: 'rgba(126, 224, 164, 0.12)', node: '#1d2d25', nodeBorder: '#2f4a3b',
  text: '#e6efe9', accent: '#7ee0a4', accentInk: '#0a1f14', edge: '#7ee0a4', link: '#f4c95d', ...DARK_MARKS,
});

export const PaperTheme = new PaletteTheme('paper', 'Папір', {
  canvas: '#f6f1e7', dot: 'rgba(90, 70, 40, 0.14)', node: '#fffaf0', nodeBorder: '#cdbd9f',
  text: '#2b2418', accent: '#1f6f50', accentInk: '#ffffff', edge: '#8a7a5c', link: '#b7791f', ...LIGHT_MARKS,
});

export const OceanTheme = new PaletteTheme('ocean', 'Океан', {
  canvas: '#0f1b2d', dot: 'rgba(120, 180, 255, 0.12)', node: '#162a45', nodeBorder: '#2d4a73',
  text: '#e4edf9', accent: '#6cb4ff', accentInk: '#06182e', edge: '#6cb4ff', link: '#ffb454', ...DARK_MARKS,
});
