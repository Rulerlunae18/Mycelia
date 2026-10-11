import { bilateralLayout } from './bilateral.js';
import { radialLayout } from './radial.js';
import { DEFAULT_OPTIONS, normalize } from './shared.js';
import { treeLayout } from './tree.js';

// Патерн Strategy. Кожна розкладка: { name, label, compute(root, options) }
// і повертає Map<id, {x, y, width, height}>. Додати нову розкладку означає
// додати файл і один рядок нижче; ні LayoutContext, ні рендерер не змінюються.
export const LAYOUTS = {
  [radialLayout.name]: radialLayout,
  [treeLayout.name]: treeLayout,
  [bilateralLayout.name]: bilateralLayout,
};

export const LAYOUT_NAMES = Object.keys(LAYOUTS); // збігається з LAYOUTS на сервері
// Двостороння читається найкраще: класичний вигляд карти думок, компактна і
// не розповзається у кола, як радіальна (у радіальній довгі підписи розсувають кільця).
export const DEFAULT_LAYOUT = 'bilateral';

export function getLayoutStrategy(name) {
  return LAYOUTS[name] ?? LAYOUTS[DEFAULT_LAYOUT];
}

// Контекст патерна: тримає поточну стратегію, дозволяє міняти її на льоту
// і приводить результат до зручного вигляду (додатні координати, розмір полотна).
export class LayoutContext {
  constructor(name = DEFAULT_LAYOUT, options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.use(name);
  }

  use(name) {
    this.strategy = getLayoutStrategy(name);
    return this;
  }

  get name() {
    return this.strategy.name;
  }

  compute(root) {
    const rects = this.strategy.compute(root, this.options);
    return normalize(rects, this.options.padding);
  }
}

export { DEFAULT_OPTIONS };
