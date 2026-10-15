import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Палітра міняється в одному місці (блок :root у style.css). Цей тест стережe, щоб жодна
// змінна, яку використовують компоненти, не лишилась без значення в жодній з палітр.
const root = join(import.meta.dirname);
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(root).filter((f) => /\.(vue|css)$/.test(f));
const css = readFileSync(join(root, 'style.css'), 'utf8');

const block = (selector) => {
  const start = css.indexOf(selector);
  return css.slice(start, css.indexOf('\n}', start));
};
const defined = (text) => new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

describe('палітра інтерфейсу', () => {
  const berry = defined(block(':root,'));
  const forest = defined(block(":root[data-palette='forest']"));

  it('кожна змінна кольору, яку хтось використовує, визначена в палітрі', () => {
    const used = new Set();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/var\((--[\w-]+)/g)) used.add(m[1]);
    const local = new Set(); // змінні, які компоненти задають самі (--n-fill, --c-accent...)
    for (const f of files) if (!f.endsWith('style.css')) for (const m of readFileSync(f, 'utf8').matchAll(/(--[\w-]+)\s*:/g)) local.add(m[1]);
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/'(--[\w-]+)'\s*:/g)) local.add(m[1]);
    const missing = [...used].filter((v) => !berry.has(v) && !local.has(v));
    expect(missing).toEqual([]);
  });

  it('запасна палітра «forest» перевизначає всі кольорові змінні основної', () => {
    const colorVars = [...berry].filter((v) => !['--radius', '--serif', '--accent', '--line', '--glass', '--danger'].includes(v));
    expect(colorVars.filter((v) => !forest.has(v))).toEqual([]);
  });
});
