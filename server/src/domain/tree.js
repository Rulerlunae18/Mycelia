// Чисті функції для роботи з плоским списком вузлів карти.
// Без БД і Express: тому легко тестуються і однаково працюють на MySQL та PostgreSQL.

// Діти вузла, відсортовані за order
export function childrenOf(nodes, parentId) {
  return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order);
}

// id вузла і всіх його нащадків у порядку обходу в глибину (спершу батько)
export function subtreeIds(nodes, rootId) {
  const result = [];
  const walk = (id) => {
    result.push(id);
    for (const child of childrenOf(nodes, id)) walk(child.id);
  };
  walk(rootId);
  return result;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Копія списку id із вставленим id на позицію index
export function insertAt(ids, id, index) {
  const copy = [...ids];
  copy.splice(clamp(index, 0, copy.length), 0, id);
  return copy;
}

// Перетворює впорядкований список id на оновлення { id, parentId, order }
export function reindex(ids, parentId) {
  return ids.map((id, order) => ({ id, parentId, order }));
}
