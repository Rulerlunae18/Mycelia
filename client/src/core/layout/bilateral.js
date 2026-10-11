import { layoutForest } from './tree.js';
import { DEFAULT_OPTIONS, visibleChildren, visibleLeafCount } from './shared.js';

// Стратегія «Двостороння»: корінь у центрі, гілки розходяться вправо і вліво.
// Діти кореня розкладаються на боки так, щоб боки були приблизно рівні за
// кількістю листків; порядок дітей на кожному боці зберігається.
export const bilateralLayout = {
  name: 'bilateral',
  label: 'Двостороння',
  compute(root, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const rootSize = opts.measure(root);
    const rects = new Map();
    rects.set(root.id, {
      x: -rootSize.width / 2,
      y: -rootSize.height / 2,
      width: rootSize.width,
      height: rootSize.height,
    });

    const right = [];
    const left = [];
    let rightWeight = 0;
    let leftWeight = 0;
    for (const child of visibleChildren(root)) {
      const weight = visibleLeafCount(child);
      if (rightWeight <= leftWeight) {
        right.push(child);
        rightWeight += weight;
      } else {
        left.push(child);
        leftWeight += weight;
      }
    }

    const offset = rootSize.width / 2 + opts.gapX;
    const place = (forest, direction) => {
      if (!forest.length) return;
      const { rects: part, height } = layoutForest(forest, opts);
      for (const [id, r] of part) {
        rects.set(id, {
          // ліва половина дзеркальна: ближній до кореня край вузлів вирівняний
          x: direction > 0 ? offset + r.x : -offset - r.x - r.width,
          y: r.y - height / 2,
          width: r.width,
          height: r.height,
        });
      }
    };
    place(right, 1);
    place(left, -1);
    return rects;
  },
};
