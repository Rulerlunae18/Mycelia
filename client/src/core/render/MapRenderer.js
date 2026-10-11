import { edgePath } from '../geometry.js';
import { LayoutContext } from '../layout/index.js';
import { labelFor } from '../layout/measure.js';
import { visibleNodes } from '../layout/shared.js';
import { assertBackend } from './RenderBackend.js';

// Патерн Bridge: «абстракція». Вирішує ЩО малювати (які вузли видимі, де вони
// стоять, які лінії між ними), а JAK малювати, лишає бекенду. Розкладка
// береться зі Strategy (LayoutContext), бекенд можна замінити під час роботи.
export class MapRenderer {
  constructor(backend, layout = new LayoutContext()) {
    this.backend = assertBackend(backend);
    this.layout = layout;
  }

  setBackend(backend) {
    this.backend = assertBackend(backend);
    return this;
  }

  // layout: назва розкладки (необов'язково), selectedId: виділений вузол
  render(root, { layout, selectedId = null } = {}) {
    if (layout) this.layout.use(layout);
    const { rects, bounds } = this.layout.compute(root);
    const backend = this.backend;
    const nodes = [...visibleNodes(root)];

    backend.begin(bounds);

    // Лінії малюємо першими, щоб вузли лягали поверх них
    for (const node of nodes) {
      if (!node.parent) continue;
      backend.drawEdge({
        fromId: node.parent.id,
        toId: node.id,
        path: edgePath(rects.get(node.parent.id), rects.get(node.id)),
        depth: node.depth,
      });
    }

    for (const node of nodes) {
      const rect = rects.get(node.id);
      const folded = node.collapsed && !node.isLeaf;
      backend.drawNode({
        id: node.id,
        rect,
        text: node.text,
        label: labelFor(node, rect.width),
        depth: node.depth,
        isRoot: node.isRoot,
        collapsed: folded,
        hiddenCount: folded ? node.size() - 1 : 0,
        selected: node.id === selectedId,
        category: node.extra.category ?? null,
        priority: node.extra.priority ?? null,
        style: node.extra.style ?? null,
      });
    }

    return backend.end();
  }
}
