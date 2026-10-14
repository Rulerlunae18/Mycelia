// Кольори для canvas-фону беремо з тих самих CSS-змінних, що й увесь інтерфейс (блок «ПАЛІТРА» у style.css),
// тож палітру змінюють в одному місці. Змінні лежать як «R G B», canvas хоче «R, G, B».
const FALLBACK = { thread: '107, 140, 136', glow: '179, 162, 238', trail: '196, 184, 245', spark: '236, 231, 255' };
const VARS = { thread: '--thread-rgb', glow: '--glow-rgb', trail: '--trail-rgb', spark: '--spark-rgb' };

export const toCommaRgb = (value) => String(value ?? '').trim().split(/[\s,]+/).filter(Boolean).join(', ');

export function readPalette(getVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name)) {
  const out = {};
  for (const [key, name] of Object.entries(VARS)) {
    const value = toCommaRgb(getVar(name));
    out[key] = /^\d+(\.\d+)?(, \d+(\.\d+)?){2}$/.test(value) ? value : FALLBACK[key];
  }
  return out;
}
