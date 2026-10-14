// Патерн Bridge: «реалізація» (implementor). Рендерер карти знає лише цей
// інтерфейс і нічого про те, чим малюють. Сьогодні це SVG-сцена для Vue,
// завтра сюди можна додати Canvas або експорт у PNG без змін у MapRenderer.
//
// Контракт бекенду (виклики йдуть у такому порядку: begin -> drawBoundary* -> drawEdge* -> drawNode* -> end):
//
//   begin(bounds, canvas)  bounds = { width, height } повного полотна, canvas = CanvasStyle теми
//   drawBoundary(b) b = { id, label, path, labelAt: {x, y}, index, look }  path = SVG-контур області, look = BoundaryStyle
//   drawEdge(edge)  edge = { fromId, toId, path, depth, look }  path = SVG-шлях кривої, look = EdgeStyle
//   drawNode(node)  node = { id, rect, text, label, depth, isRoot, collapsed,
//                            hiddenCount, selected, category, priority, style,
//                            look (NodeStyle), inset, attachmentCount, hasNote, marks: { category, priority } }
//   end()           повертає результат малювання (сцену, зображення тощо)

export const BACKEND_METHODS = ['begin', 'drawBoundary', 'drawEdge', 'drawNode', 'end'];

export function assertBackend(backend) {
  const missing = BACKEND_METHODS.filter((m) => typeof backend?.[m] !== 'function');
  if (missing.length) {
    throw new TypeError(`Бекенд малювання не реалізує: ${missing.join(', ')}`);
  }
  return backend;
}
