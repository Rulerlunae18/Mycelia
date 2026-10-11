// Куди впаде вузол, який тягнуть. Чиста функція без Vue і DOM: приймає дерево,
// прямокутники з розкладки й точку у координатах сцени, тому легко тестується.
//
// Правила:
//  - середина вузла-цілі: перетягуваний стає його останньою дитиною;
//  - край вузла-цілі (чверть висоти, а в розкладці «дерево» чверть ширини):
//    перетягуваний стає сусідом перед або після цілі (так змінюють порядок);
//  - корінь можна лише приймати: сусідом кореня стати неможливо;
//  - не можна кидати вузол на самого себе чи у своє піддерево;
//  - якщо нічого б не змінилось, повертаємо null.

const EDGE = 0.25;

const inside = (r, p) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

export function dropTarget(root, rects, draggedId, point, { axis = 'y' } = {}) {
  const dragged = root.find(draggedId);
  if (!dragged || dragged.isRoot) return null;

  for (const [id, rect] of rects) {
    if (!inside(rect, point)) continue;
    const target = root.find(id);
    if (!target || dragged.contains(target)) continue; // сам вузол або його піддерево

    // Позиція на цільовому вузлі від 0 до 1 уздовж осі, якою розкладка впорядковує сусідів
    const along = axis === 'x' ? (point.x - rect.x) / rect.width : (point.y - rect.y) / rect.height;
    let kind = 'child';
    if (!target.isRoot && along < EDGE) kind = 'before';
    else if (!target.isRoot && along > 1 - EDGE) kind = 'after';

    const parent = kind === 'child' ? target : target.parent;
    const siblings = parent.children.filter((c) => c !== dragged);
    let index = siblings.length;
    if (kind !== 'child') index = siblings.indexOf(target) + (kind === 'after' ? 1 : 0);

    const unchanged = dragged.parent === parent && parent.children.indexOf(dragged) === index;
    if (unchanged) return null;
    return { parentId: parent.id, index, kind, targetId: target.id };
  }
  return null;
}
