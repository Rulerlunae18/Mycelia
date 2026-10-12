// Каталог значків: що користувач може поставити на вузол. Це дані, а не вигляд:
// кольори значків залежать від теми й обираються фабрикою (див. theme/).
// Списки ключів збігаються з CATEGORIES і PRIORITIES на сервері (validation.js).

export const CATEGORIES = [
  { key: 'idea', label: 'Ідея', glyph: '★' },
  { key: 'task', label: 'Задача', glyph: '✓' },
  { key: 'question', label: 'Питання', glyph: '?' },
  { key: 'info', label: 'Інформація', glyph: 'i' },
  { key: 'risk', label: 'Ризик', glyph: '▲' },
  { key: 'decision', label: 'Рішення', glyph: '◆' },
];

export const PRIORITIES = [
  { key: 'low', label: 'Низька', glyph: '↓' },
  { key: 'normal', label: 'Звичайна', glyph: '=' },
  { key: 'high', label: 'Висока', glyph: '↑' },
  { key: 'urgent', label: 'Термінова', glyph: '!' },
];

const byKey = (list) => new Map(list.map((m) => [m.key, m]));
const categoryByKey = byKey(CATEGORIES);
const priorityByKey = byKey(PRIORITIES);

// Невідомий ключ (наприклад, зі старих даних) просто не малюється
export const findCategory = (key) => categoryByKey.get(key) ?? null;
export const findPriority = (key) => priorityByKey.get(key) ?? null;

// Місце під значок категорії всередині вузла (ліворуч від тексту)
export const CATEGORY_INSET = 26;
