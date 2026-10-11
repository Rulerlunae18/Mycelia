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
