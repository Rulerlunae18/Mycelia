// Контур області: пунктирна лінія навколо групи вузлів. Чиста геометрія без Vue і DOM.
// Береться опукла оболонка кутів вузлів (з відступом) і скруглюється: так контур щільніший
// за звичайний прямокутник і не залежить від розкладки.

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

// Опукла оболонка (алгоритм Ендрю): вершини по колу, без повторів
export function convexHull(points) {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const build = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...build(pts), ...build([...pts].reverse())];
}

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fmt = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${fmt(p.x)} ${fmt(p.y)}`;

// SVG-шлях багатокутника зі скругленими кутами (квадратична крива в кожній вершині)
export function roundedPath(points, radius) {
  const n = points.length;
  let d = '';
  points.forEach((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const before = lerp(p, prev, Math.min(radius / dist(p, prev), 0.5));
    const after = lerp(p, next, Math.min(radius / dist(p, next), 0.5));
    d += `${i === 0 ? 'M' : 'L'} ${pt(before)} Q ${pt(p)} ${pt(after)} `;
  });
  return `${d}Z`;
}

// rects: прямокутники вузлів області { x, y, width, height }.
// Повертає { path, labelAt } або null, якщо вузлів немає.
export function boundaryOutline(rects, { pad = 16, radius = 22 } = {}) {
  if (!rects.length) return null;
  const corners = rects.flatMap((r) => [
    { x: r.x - pad, y: r.y - pad },
    { x: r.x + r.width + pad, y: r.y - pad },
    { x: r.x + r.width + pad, y: r.y + r.height + pad },
    { x: r.x - pad, y: r.y + r.height + pad },
  ]);
  const hull = convexHull(corners);
  const minY = Math.min(...hull.map((p) => p.y));
  const minX = Math.min(...hull.filter((p) => p.y === minY).map((p) => p.x));
  return { path: roundedPath(hull, radius), labelAt: { x: minX + radius, y: minY - 6 } };
}
