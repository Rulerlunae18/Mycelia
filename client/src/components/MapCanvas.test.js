// Перевіряє, що компонент полотна справді компілюється і відображає сцену.
// Рендеримо на «сервері» (без браузера): ловить помилки шаблону й екранування.
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { TreeNode } from '../core/TreeNode.js';
import MapCanvas from './MapCanvas.vue';

function sample() {
  const root = new TreeNode({ id: 'r', text: 'Корінь' });
  const a = root.add(new TreeNode({ id: 'a', text: 'Перша' }));
  root.add(new TreeNode({ id: 'b', text: '<b onclick="x()">Друга</b>' }));
  a.add(new TreeNode({ id: 'a1', text: 'Вкладена' }));
  return { root, a };
}

const render = (props) => renderToString(createSSRApp({ render: () => h(MapCanvas, props) }));

describe('MapCanvas', () => {
  it('малює вузол і лінію для кожного видимого вузла', async () => {
    const { root } = sample();
    const html = await render({ root, layout: 'tree' });
    expect(html.match(/class="edge"/g)).toHaveLength(3);
    expect(html.match(/role="button"/g)).toHaveLength(4);
    expect(html).toContain('Перша');
    expect(html).toContain('Вкладена');
  });

  it('текст вузла екранується, розмітка з нього не потрапляє в DOM', async () => {
    const html = await render({ root: sample().root, layout: 'radial' });
    expect(html).not.toContain('<b onclick');
    expect(html).toContain('&lt;b onclick');
  });

  it('виділений вузол отримує клас selected', async () => {
    const html = await render({ root: sample().root, layout: 'radial', selectedId: 'a' });
    // порядок класів у Vue не гарантований, тому шукаємо слово selected
    expect(html.match(/class="[^"]*\bselected\b[^"]*"/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true"');
  });

  it('згорнута гілка ховає нащадків і показує бейдж з кількістю', async () => {
    const { root, a } = sample();
    a.collapsed = true;
    const html = await render({ root, layout: 'bilateral' });
    expect(html).not.toContain('Вкладена');
    expect(html).toContain('+1');
    expect(html).toContain('folded');
  });

  it('кожна з трьох розкладок рендериться без помилок', async () => {
    for (const layout of ['radial', 'tree', 'bilateral', 'невідома']) {
      const html = await render({ root: sample().root, layout });
      expect(html).toContain('<svg');
    }
  });

  it('малює значки категорії і терміновості з підказкою', async () => {
    const root = new TreeNode({ id: 'r', text: 'Корінь' });
    root.add(new TreeNode({ id: 'a', text: 'Купити', category: 'task', priority: 'high' }));
    const html = await render({ root, layout: 'tree', theme: 'ocean' });
    expect(html).toContain('✓');
    expect(html).toContain('↑');
    expect(html).toMatch(/<title[^>]*>Висока<\/title>/);
    expect(html).toMatch(/<title[^>]*>Задача<\/title>/); // підказка значка категорії
    expect(html).toMatch(/<title[^>]*>Купити<\/title>/); // підказка вузла
  });

  it('малює область пунктиром з підписом, а текст підпису екранується', async () => {
    const { root } = sample();
    const html = await render({ root, layout: 'tree', boundaries: [{ id: 'z', label: '<i>Фаза</i>', nodeIds: ['a', 'a1'] }] });
    expect(html).toContain('class="boundary"');
    expect(html).toContain('&lt;i&gt;Фаза');
    expect(html).not.toContain('<i>Фаза');
  });
});
