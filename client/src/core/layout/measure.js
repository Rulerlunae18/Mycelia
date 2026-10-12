import { CATEGORY_INSET } from '../marks.js';

// Оцінка розміру вузла за текстом. Справжніх шрифтів тут немає навмисно:
// ядро не залежить від браузера, тому ширину рахуємо за середньою шириною символу.

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export const NODE_HEIGHT = 36;
export const ROOT_HEIGHT = 46;
const CHAR_WIDTH = 7.5;
const ROOT_CHAR_WIDTH = 8.8;
const PADDING_X = 24;
const MIN_WIDTH = 72;
const MIN_ROOT_WIDTH = 120;
export const MAX_WIDTH = 240;

// Текст, який бачить користувач (порожній вузол теж має підпис)
export function displayText(node) {
  return node.text && node.text.trim() ? node.text : 'без тексту';
}

// Ширина, яку займає значок категорії зліва від тексту
const insetOf = (node) => (node.extra?.category ? CATEGORY_INSET : 0);

export function measureNode(node) {
  const isRoot = node.isRoot;
  const charWidth = isRoot ? ROOT_CHAR_WIDTH : CHAR_WIDTH;
  const length = [...displayText(node)].length;
  // ceil, а не round: інакше ширина може вийти на пів символу меншою, і підпис обріжеться
  const width = clamp(
    Math.ceil(length * charWidth + PADDING_X) + insetOf(node),
    isRoot ? MIN_ROOT_WIDTH : MIN_WIDTH,
    MAX_WIDTH + insetOf(node),
  );
  return { width, height: isRoot ? ROOT_HEIGHT : NODE_HEIGHT };
}

// Підпис, обрізаний під ширину вузла (довгий текст закінчується «…»)
export function labelFor(node, width) {
  const charWidth = node.isRoot ? ROOT_CHAR_WIDTH : CHAR_WIDTH;
  const chars = [...displayText(node)];
  // + 1e-9: на межі (15 символів * 8.8) ділення дає 14.999999..., і зайвий символ губиться
  const max = Math.max(1, Math.floor((width - insetOf(node) - PADDING_X) / charWidth + 1e-9));
  if (chars.length <= max) return chars.join('');
  return chars.slice(0, max - 1).join('').trimEnd() + '…';
}
