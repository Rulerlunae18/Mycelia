// Патерн Abstract Factory: інтерфейс «фабрики теми». Клієнт (MapRenderer) просить
// у фабрики стиль вузла, лінії, значка й полотна і не знає, яка саме тема працює;
// конкретні фабрики гарантують, що всі ці продукти узгоджені між собою.

const abstract = (name) => {
  throw new Error(`Фабрика теми має реалізувати ${name}()`);
};

export class ThemeFactory {
  get name() { return abstract('name'); }
  get label() { return abstract('label'); }

  /** @returns {import('./products').NodeStyle} */
  createNodeStyle(/* { isRoot, selected } */) { return abstract('createNodeStyle'); }

  /** @returns {import('./products').EdgeStyle} */
  createEdgeStyle(/* depth */) { return abstract('createEdgeStyle'); }

  /** kind: 'category' | 'priority'; @returns {import('./products').MarkStyle} */
  createMarkStyle(/* kind, key */) { return abstract('createMarkStyle'); }

  /** index: порядковий номер області, щоб сусідні мали різні кольори; @returns {import('./products').BoundaryStyle} */
  createBoundaryStyle(/* index */) { return abstract('createBoundaryStyle'); }

  /** @returns {import('./products').CanvasStyle} */
  createCanvasStyle() { return abstract('createCanvasStyle'); }
}
