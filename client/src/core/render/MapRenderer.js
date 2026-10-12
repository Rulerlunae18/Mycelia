import { edgePath } from '../geometry.js';
import { boundaryOutline } from '../boundary.js';
import { LayoutContext } from '../layout/index.js';
import { CATEGORY_INSET, findCategory, findPriority } from '../marks.js';
import { getTheme } from '../theme/index.js';
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

  // layout: назва розкладки, selectedId: виділений вузол, theme: назва теми
  // (стилі дає фабрика теми, Abstract Factory)
  render(root, { layout, selectedId = null, theme, boundaries = [] } = {}) {
    if (layout) this.layout.use(layout);
    const factory = getTheme(theme);
    const { rects, bounds } = this.layout.compute(root);
    const backend = this.backend;
    const nodes = [...visibleNodes(root)];

    backend.begin(bounds, factory.createCanvasStyle());

    // Області під усім. Прямокутники є лише у видимих вузлів, тож згорнута гілка
    // просто не впливає на контур; область без видимих вузлів не малюється.
    boundaries.forEach((b, index) => {
      const outline = boundaryOutline(b.nodeIds.map((id) => rects.get(id)).filter(Boolean));
      if (!outline) return;
      backend.drawBoundary({
        id: b.id,
        label: b.label ?? '',
        path: outline.path,
        labelAt: outline.labelAt,
        index,
        look: factory.createBoundaryStyle(index),
      });
    });

    // Лінії малюємо першими, щоб вузли лягали поверх них
    for (const node of nodes) {
      if (!node.parent) continue;
      backend.drawEdge({
        fromId: node.parent.id,
        toId: node.id,
        path: edgePath(rects.get(node.parent.id), rects.get(node.id)),
        depth: node.depth,
        look: factory.createEdgeStyle(node.depth),
      });
    }

    for (const node of nodes) {
      const rect = rects.get(node.id);
      const folded = node.collapsed && !node.isLeaf;
      const category = findCategory(node.extra.category);
      const priority = findPriority(node.extra.priority);
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
        look: factory.createNodeStyle({ isRoot: node.isRoot, selected: node.id === selectedId }),
        inset: category ? CATEGORY_INSET : 0,
        marks: {
          category: category && { ...category, ...factory.createMarkStyle('category', category.key) },
          priority: priority && { ...priority, ...factory.createMarkStyle('priority', priority.key) },
        },
      });
    }

    return backend.end();
  }
}
