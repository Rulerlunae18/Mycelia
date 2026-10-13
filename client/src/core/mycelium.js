// Процедурна грибниця для фону: мережа ниток, що росте з країв екрана, і шляхи для світлових імпульсів.
// Чиста логіка без DOM, щоб її можна було перевірити тестами. Малює компонент MyceliumBackdrop.

// Невеликий детермінований генератор: однакове зерно дає однакову мережу
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Вирощує мережу. Вузол: { x, y, parent (індекс або -1), gen (покоління гілки), leaf }.
 * Нитки ростуть по колу від країв до центру: кожен раунд кожна жива верхівка робить один крок,
 * тому мережа розвивається рівномірно, а не одним довгим коренем.
 */
export function growNetwork({ width, height, seed = 7, maxNodes = 2200 }) {
  const rng = makeRng(seed);
  const nodes = [];
  const margin = 40;
  const inside = (x, y) => x > -margin && x < width + margin && y > -margin && y < height + margin;

  const seeds = Math.max(5, Math.round((width + height) / 330));
  let tips = [];
  for (let i = 0; i < seeds; i++) {
    // Корені з нижнього та бокових країв, нитка спрямована всередину
    const side = rng();
    let x; let y; let angle;
    if (side < 0.55) { x = rng() * width; y = height + 10; angle = -Math.PI / 2 + (rng() - 0.5) * 0.9; }
    else if (side < 0.78) { x = -10; y = height * (0.3 + rng() * 0.7); angle = (rng() - 0.5) * 0.9; }
    else { x = width + 10; y = height * (0.3 + rng() * 0.7); angle = Math.PI + (rng() - 0.5) * 0.9; }
    nodes.push({ x, y, parent: -1, gen: 0, leaf: true });
    tips.push({ index: nodes.length - 1, x, y, angle, gen: 0, life: 70 + Math.floor(rng() * 70) });
  }

  while (tips.length && nodes.length < maxNodes) {
    const next = [];
    for (const tip of tips) {
      if (nodes.length >= maxNodes) break;
      const step = 9 + rng() * 9;
      const angle = tip.angle + (rng() - 0.5) * 0.75;
      const x = tip.x + Math.cos(angle) * step;
      const y = tip.y + Math.sin(angle) * step;
      if (!inside(x, y)) continue;
      nodes[tip.index].leaf = false;
      nodes.push({ x, y, parent: tip.index, gen: tip.gen, leaf: true });
      const index = nodes.length - 1;
      const life = tip.life - 1;
      if (life > 0) next.push({ index, x, y, angle, gen: tip.gen, life });
      // Розгалуження: з часом рідшає, нова гілка коротше і тонше
      if (life > 12 && tip.gen < 4 && rng() < 0.085) {
        const turn = (0.45 + rng() * 0.6) * (rng() < 0.5 ? -1 : 1);
        next.push({ index, x, y, angle: angle + turn, gen: tip.gen + 1, life: Math.floor(life * (0.5 + rng() * 0.3)) });
      }
    }
    tips = next;
  }
  return nodes;
}

// Ланцюжок вузлів від кореня до вузла `index`
export function pathTo(nodes, index) {
  const chain = [];
  for (let i = index; i !== -1; i = nodes[i].parent) chain.push(i);
  return chain.reverse();
}

// Шлях для імпульсу: точки й накопичена довжина, щоб швидко знаходити позицію за відстанню
export function buildPath(nodes, index) {
  const points = pathTo(nodes, index).map((i) => ({ x: nodes[i].x, y: nodes[i].y }));
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { points, cum, length: cum[cum.length - 1] };
}

// Точка на шляху на відстані s від початку
export function pointAt(path, s) {
  const { points, cum } = path;
  if (s <= 0) return points[0];
  if (s >= path.length) return points[points.length - 1];
  let lo = 0; let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return { x: points[lo].x + (points[hi].x - points[lo].x) * t, y: points[lo].y + (points[hi].y - points[lo].y) * t };
}

// Вибирає кінець гілки, до якого довго бігти: короткі обривки як імпульс виглядають жалюгідно
export function pickRoute(nodes, rng, minLength = 220) {
  const leaves = [];
  for (let i = 0; i < nodes.length; i++) if (nodes[i].leaf) leaves.push(i);
  for (let attempt = 0; attempt < 12 && leaves.length; attempt++) {
    const path = buildPath(nodes, leaves[Math.floor(rng() * leaves.length)]);
    if (path.length >= minLength) return path;
  }
  return null;
}
