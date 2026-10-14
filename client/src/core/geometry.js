// Геометрія ліній між вузлами. Чисті функції, без залежностей.

const round = (n) => Math.round(n * 10) / 10;

export const centerOf = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// Крива Безьє від батьківського прямокутника до дочірнього.
// Сторони з'єднання вибираються за взаємним розташуванням: якщо дитина
// повністю правіше (лівіше), лінія йде з бокових сторін, інакше зверху/знизу.
// Тому одна функція однаково обслуговує всі розкладки.
export function edgePath(from, to) {
  let x1;
  let y1;
  let x2;
  let y2;
  let horizontal = true;

  if (to.x >= from.x + from.width) {
    x1 = from.x + from.width;
    x2 = to.x;
  } else if (to.x + to.width <= from.x) {
    x1 = from.x;
    x2 = to.x + to.width;
  } else {
    horizontal = false;
  }

  if (horizontal) {
    y1 = from.y + from.height / 2;
    y2 = to.y + to.height / 2;
    const mid = (x1 + x2) / 2;
    return `M${round(x1)} ${round(y1)}C${round(mid)} ${round(y1)} ${round(mid)} ${round(y2)} ${round(x2)} ${round(y2)}`;
  }

  x1 = from.x + from.width / 2;
  x2 = to.x + to.width / 2;
  if (to.y >= from.y + from.height) {
    y1 = from.y + from.height;
    y2 = to.y;
  } else {
    y1 = from.y;
    y2 = to.y + to.height;
  }
  const mid = (y1 + y2) / 2;
  return `M${round(x1)} ${round(y1)}C${round(x1)} ${round(mid)} ${round(x2)} ${round(mid)} ${round(x2)} ${round(y2)}`;
}

// Точка, де промінь із центра прямокутника в бік (tx, ty) виходить за його межі
function exitPoint(r, tx, ty) {
  const c = centerOf(r);
  const dx = tx - c.x;
  const dy = ty - c.y;
  if (dx === 0 && dy === 0) return c;
  const k = Math.min(dx !== 0 ? r.width / 2 / Math.abs(dx) : Infinity, dy !== 0 ? r.height / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * k, y: c.y + dy * k };
}

const ARROW = 9; // довжина стрілки

// Зв'язок між довільними вузлами: вигнута лінія від краю одного прямокутника до краю
// іншого зі стрілкою на кінці. Вигин іде вбік від напрямку, тому зв'язки A→B і B→A
// не накладаються. Повертає шлях лінії, шлях стрілки і точку для підпису.
export function linkPath(from, to) {
  const a = centerOf(from);
  const b = centerOf(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bow = Math.min(70, 18 + dist * 0.18);
  const ctrl = { x: (a.x + b.x) / 2 - (dy / dist) * bow, y: (a.y + b.y) / 2 + (dx / dist) * bow };

  const p0 = exitPoint(from, ctrl.x, ctrl.y);
  const p2 = exitPoint(to, ctrl.x, ctrl.y);
  const tx = p2.x - ctrl.x;
  const ty = p2.y - ctrl.y;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;

  // лінія закінчується біля основи стрілки, а вістря торкається краю вузла
  const base = { x: p2.x - ux * ARROW, y: p2.y - uy * ARROW };
  const wing = ARROW * 0.5;
  const arrow = `M${round(p2.x)} ${round(p2.y)}L${round(base.x - uy * wing)} ${round(base.y + ux * wing)}L${round(base.x + uy * wing)} ${round(base.y - ux * wing)}Z`;

  return {
    d: `M${round(p0.x)} ${round(p0.y)}Q${round(ctrl.x)} ${round(ctrl.y)} ${round(base.x)} ${round(base.y)}`,
    arrow,
    labelAt: { x: round(0.25 * p0.x + 0.5 * ctrl.x + 0.25 * p2.x), y: round(0.25 * p0.y + 0.5 * ctrl.y + 0.25 * p2.y) },
  };
}
