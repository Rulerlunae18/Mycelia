// Буфер гілок. Копіювання робить знімок гілки (звичайні дані без id), а вставка з цього знімка
// створює нові вузли з новими id: так само працює Prototype на сервері, тільки тут
// знімок може пережити перехід на іншу карту.
// Знімок гілки: вкладений опис без id, тож його можна вставити куди завгодно і скільки завгодно разів
export function snapshotBranch(node) {
  return {
    text: node.text,
    collapsed: !!node.collapsed,
    style: node.extra.style ?? null,
    category: node.extra.category ?? null,
    priority: node.extra.priority ?? null,
    note: node.extra.note ?? null,
    children: node.children.map(snapshotBranch),
  };
}

export const countNodes = (snap) => 1 + snap.children.reduce((sum, c) => sum + countNodes(c), 0);

// Рядки для сервера (POST /nodes/restore): спершу батько, потім діти. Корінь отримує parentId
// і позицію index, решта вкладені за порядком. Знімок не змінюється (style копіюється глибоко).
export function materialize(snap, { parentId, index, newId = () => crypto.randomUUID() }) {
  const rows = [];
  const walk = (s, parent, order) => {
    const id = newId();
    rows.push({
      id,
      parentId: parent,
      text: s.text,
      collapsed: s.collapsed,
      style: s.style === null ? null : structuredClone(s.style),
      category: s.category,
      priority: s.priority,
      note: s.note,
      order,
    });
    s.children.forEach((c, i) => walk(c, id, i));
  };
  walk(snap, parentId, index);
  return rows;
}

// Текст для системного буфера обміну: відступний список, який можна вставити в нотатки чи документ
export function asText(node) {
  const line = (n) => String(n.text ?? '').replace(/\s*\n\s*/g, ' ').trim() || 'без тексту';
  const lines = [line(node)];
  const walk = (n, depth) => {
    lines.push(`${'  '.repeat(depth)}- ${line(n)}`);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  node.children.forEach((c) => walk(c, 0));
  return `${lines.join('\n')}\n`;
}
