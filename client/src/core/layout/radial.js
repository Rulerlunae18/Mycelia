import { DEFAULT_OPTIONS, visibleChildren, visibleLeafCount } from './shared.js';

const TWO_PI = Math.PI * 2;

// Стратегія «Радіальна»: корінь у центрі, кожна глибина лежить на своєму кільці.
// Гілка отримує сектор кола, пропорційний кількості її листків, а діти ділять
// сектор батька. Кути залежать лише від ваг, тому спершу рахуємо кути, а вже
// потім радіуси кілець, достатні, щоб вузли не перетинались.
export const radialLayout = {
  name: 'radial',
  label: 'Радіальна',
  compute(root, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const sizes = new Map();
    const angles = new Map();
    const depths = new Map();
    const levels = []; // вузли кожної глибини: { id, angle, width, height }

    const assign = (node, depth, from, to) => {
      const size = opts.measure(node);
      const angle = (from + to) / 2;
      sizes.set(node.id, size);
      angles.set(node.id, angle);
      depths.set(node.id, depth);
      (levels[depth] ??= []).push({ id: node.id, angle, ...size });

      const kids = visibleChildren(node);
      if (!kids.length) return;
      const total = kids.reduce((s, k) => s + visibleLeafCount(k), 0);
      let start = from;
      for (const kid of kids) {
        const span = ((to - from) * visibleLeafCount(kid)) / total;
        assign(kid, depth + 1, start, start + span);
        start += span;
      }
    };

    // Обертаємо коло так, щоб середина першого сектора дивилась угору
    const kids = visibleChildren(root);
    const total = kids.length ? kids.reduce((s, k) => s + visibleLeafCount(k), 0) : 1;
    const firstSpan = kids.length ? (TWO_PI * visibleLeafCount(kids[0])) / total : TWO_PI;
    const startAngle = -Math.PI / 2 - firstSpan / 2;
    assign(root, 0, startAngle, startAngle + TWO_PI);

    const radius = [0];
    for (let d = 1; d < levels.length; d += 1) {
      radius[d] = Math.max(
        radius[d - 1] + ringStep(levels[d - 1], levels[d], opts),
        sameRingRadius(levels[d], opts.gapY),
      );
    }

    const rects = new Map();
    for (const [id, angle] of angles) {
      const { width, height } = sizes.get(id);
      const r = radius[depths.get(id)];
      const cx = r * Math.cos(angle);
      const cy = r * Math.sin(angle);
      rects.set(id, { x: cx - width / 2, y: cy - height / 2, width, height });
    }
    return rects;
  },
};

// Мінімальна відстань між сусідніми кільцями. Два прямокутники не перетинаються,
// якщо рознесені по x не менш ніж на A або по y не менш ніж на B. Вектор
// довжиною sqrt(A² + B²) завжди виходить за цей прямокутник у будь-якому
// напрямку, тож такий крок безпечний для будь-яких кутів.
function ringStep(prev, cur, opts) {
  const maxW = Math.max(...prev.map((n) => n.width)) / 2 + Math.max(...cur.map((n) => n.width)) / 2;
  const maxH = Math.max(...prev.map((n) => n.height)) / 2 + Math.max(...cur.map((n) => n.height)) / 2;
  // між кільцями вистачає вужчого проміжку, ніж між стовпцями дерева:
  // лінія тут коротка, а кути вузлів різні
  return Math.hypot(maxW + opts.gapX * 0.6, maxH + opts.gapY);
}

// Найменший радіус кільця, на якому жодна пара вузлів цієї глибини не перетинається.
// Для фіксованих кутів відстані по x і y пропорційні радіусу, тому умову
// «рознесені по x на A або по y на B» можна розв'язати точно для кожної пари.
function sameRingRadius(nodes, gap) {
  let needed = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const dCos = Math.abs(Math.cos(a.angle) - Math.cos(b.angle));
      const dSin = Math.abs(Math.sin(a.angle) - Math.sin(b.angle));
      const byX = dCos > 1e-9 ? ((a.width + b.width) / 2 + gap) / dCos : Infinity;
      const byY = dSin > 1e-9 ? ((a.height + b.height) / 2 + gap) / dSin : Infinity;
      const need = Math.min(byX, byY);
      if (Number.isFinite(need)) needed = Math.max(needed, need);
    }
  }
  return needed;
}
