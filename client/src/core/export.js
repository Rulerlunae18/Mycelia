// Експорт карти у файли. Чиста частина (SVG-рядок, Markdown, ім'я файла) тестується;
// частина з браузером (PNG, завантаження) тримається окремо внизу.
import { findCategory, findPriority } from './marks.js';
import { MapRenderer } from './render/MapRenderer.js';
import { SvgFileBackend } from './render/SvgFileBackend.js';

// Той самий рендерер, що малює полотно, але з бекендом, який збирає SVG-файл (Bridge)
export function renderSvg(root, { layout, theme, boundaries = [], attachmentCounts = {} } = {}) {
  return new MapRenderer(new SvgFileBackend()).render(root, { layout, theme, boundaries, attachmentCounts });
}

// Ім'я файла з назви карти: без символів, заборонених у Windows, і без крапок на кінці
export function fileName(title, ext) {
  const base = String(title ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 80);
  return `${base || 'Mycelia'}.${ext}`;
}

const tagsOf = (node) =>
  [findCategory(node.extra.category)?.label, findPriority(node.extra.priority)?.label].filter(Boolean);

// Структура карти як Markdown: корінь заголовком, далі вкладений список, нотатки цитатою
export function toMarkdown(root) {
  const lines = [`# ${oneLine(root.text) || 'Без назви'}`];
  const note = (node, indent) => {
    if (!node.extra.note) return;
    for (const line of String(node.extra.note).split(/\r?\n/)) lines.push(`${indent}  > ${line}`.trimEnd());
  };
  if (root.extra.note) {
    lines.push('');
    for (const line of String(root.extra.note).split(/\r?\n/)) lines.push(`> ${line}`.trimEnd());
  }
  lines.push('');
  const walk = (node, depth) => {
    const indent = '  '.repeat(depth);
    const tags = tagsOf(node);
    lines.push(`${indent}- ${oneLine(node.text) || 'без тексту'}${tags.length ? ` _(${tags.join(', ')})_` : ''}`);
    note(node, indent);
    node.children.forEach((c) => walk(c, depth + 1));
  };
  root.children.forEach((c) => walk(c, 0));
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

const oneLine = (text) => String(text ?? '').replace(/\s*\n\s*/g, ' ').trim();

// ---- браузер ----

const MAX_SIDE = 8192; // обмеження canvas у браузерах: більші картинки не малюються

export function svgToPng(svg, { scale = 2 } = {}) {
  const size = /width="(\d+)" height="(\d+)"/.exec(svg);
  const width = Number(size?.[1] ?? 800);
  const height = Number(size?.[2] ?? 600);
  const k = Math.min(scale, MAX_SIDE / width, MAX_SIDE / height);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * k);
      canvas.height = Math.round(height * k);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Не вдалося створити PNG'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не вдалося намалювати карту у PNG'));
    };
    img.src = url;
  });
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
