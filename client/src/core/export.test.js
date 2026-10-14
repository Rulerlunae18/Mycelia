import { describe, expect, it } from 'vitest';
import { fileName, renderSvg, toMarkdown } from './export.js';
import { TreeNode } from './TreeNode.js';
import { MapRenderer } from './render/MapRenderer.js';
import { SvgFileBackend, escapeXml } from './render/SvgFileBackend.js';

function sample() {
  const root = new TreeNode({ id: 'r', text: 'A <b> & "q"' });
  const a = root.add(new TreeNode({ id: 'a', text: 'Ідея', category: 'idea', priority: 'urgent', note: 'Перший рядок\nДругий' }));
  root.add(new TreeNode({ id: 'b', text: 'B' }));
  a.add(new TreeNode({ id: 'a1', text: 'A1' }));
  a.add(new TreeNode({ id: 'a2', text: 'A2' }));
  return { root, a };
}

describe('SVG-експорт (Bridge: SvgFileBackend)', () => {
  it('збирає самодостатній SVG: без CSS-змінних, зі всіма вузлами й лініями', () => {
    const { root } = sample();
    const svg = renderSvg(root, { layout: 'tree', theme: 'forest' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toContain('var(');
    expect((svg.match(/data-node-id=/g) ?? []).length).toBe(5);
    expect((svg.match(/<path d=/g) ?? []).length).toBeGreaterThanOrEqual(4); // лінії від кореня й від A
    expect(svg).toMatch(/viewBox="-16 -16 \d+ \d+"/);
  });

  it('екранує текст: теги й лапки з назв не потрапляють у розмітку', () => {
    const { root } = sample();
    const svg = renderSvg(root, { layout: 'tree', theme: 'forest' });
    expect(svg).toContain('A &lt;b&gt; &amp; &quot;q&quot;');
    expect(svg).not.toContain('<b>');
    expect(escapeXml("a'b")).toBe('a&apos;b');
  });

  it('теги збалансовані', () => {
    const { root } = sample();
    const svg = renderSvg(root, { layout: 'radial', theme: 'paper', boundaries: [{ id: 'x', label: 'Група', nodeIds: ['a', 'a1'] }], attachmentCounts: { a: 2 } });
    const count = (re) => (svg.match(re) ?? []).length;
    expect(count(/<g[ >]/g)).toBe(count(/<\/g>/g));
    expect(count(/<text/g)).toBe(count(/<\/text>/g));
    expect(svg).toContain('stroke-dasharray="9 6"');
    expect(svg).toContain('Група');
  });

  it('значки: вкладення, нотатка і лічильник згорнутої гілки', () => {
    const { root, a } = sample();
    a.collapsed = true;
    const svg = renderSvg(root, { layout: 'tree', theme: 'ocean', attachmentCounts: { a: 3 } });
    expect(svg).toContain('>3</text>'); // вкладення
    expect(svg).toContain('M4.5 5h7'); // значок нотатки
    expect(svg).toContain('>+2</text>'); // сховано A1 і A2
    expect(svg).toContain('stroke-dasharray="5 3"');
  });

  it('кожна тема дає свій фон', () => {
    const { root } = sample();
    const a = renderSvg(root, { layout: 'tree', theme: 'forest' });
    const b = renderSvg(root, { layout: 'tree', theme: 'paper' });
    expect(a).not.toBe(b);
  });

  it('той самий рендерер працює з обома бекендами', () => {
    const { root } = sample();
    expect(typeof new MapRenderer(new SvgFileBackend()).render(root, { layout: 'tree', theme: 'forest' })).toBe('string');
  });
});

describe('Markdown-експорт', () => {
  it('корінь заголовком, гілки вкладеним списком, значки і нотатки', () => {
    const { root } = sample();
    const md = toMarkdown(root);
    expect(md.split('\n')[0]).toBe('# A <b> & "q"');
    expect(md).toContain('- Ідея _(');
    expect(md).toContain('  - A1');
    expect(md).toContain('  > Перший рядок');
    expect(md).toContain('  > Другий');
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });

  it('багаторядкова назва вузла зводиться до одного рядка', () => {
    const root = new TreeNode({ id: 'r', text: 'Корінь' });
    root.add(new TreeNode({ id: 'a', text: 'Рядок 1\nРядок 2' }));
    expect(toMarkdown(root)).toContain('- Рядок 1 Рядок 2');
  });
});

describe('ім\'я файла', () => {
  it('прибирає заборонені символи й крапки на кінці', () => {
    expect(fileName('Курсова: «ТРПЗ»?', 'svg')).toBe('Курсова «ТРПЗ».svg');
    expect(fileName('a/b\\c', 'png')).toBe('a b c.png');
    expect(fileName('Назва...', 'md')).toBe('Назва.md');
  });
  it('порожня назва замінюється на Mycelia, довга обрізається', () => {
    expect(fileName('  ', 'svg')).toBe('Mycelia.svg');
    expect(fileName('я'.repeat(200), 'svg').length).toBe(84);
  });

  it("зв'язки потрапляють у SVG і в Markdown, а підписи екрануються", () => {
    const { root } = sample();
    const links = [{ id: 'l', fromId: 'a1', toId: 'b', label: 'A & <B>' }, { id: 'm', fromId: 'a', toId: 'zzz', label: 'зникле' }];
    const svg = renderSvg(root, { layout: 'tree', theme: 'forest', links });
    expect(svg).toContain('stroke-dasharray="7 5"');
    expect(svg).toContain('A &amp; &lt;B&gt;');
    expect(svg).not.toContain('A & <B>');
    expect(renderSvg(root, { layout: 'tree', theme: 'forest' })).not.toContain('stroke-dasharray="7 5"');
    const md = toMarkdown(root, { links });
    expect(md).toContain("## Зв'язки");
    expect(md).toContain('- A1 → B: A & <B>');
    expect(md).not.toContain('зникле'); // кінець зв'язку, якого немає в карті, пропускаємо
    expect(toMarkdown(root)).not.toContain("Зв'язки");
  });
});
