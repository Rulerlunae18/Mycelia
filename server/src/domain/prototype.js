import { randomUUID } from 'node:crypto';
import { childrenOf } from './tree.js';

// Патерн Prototype. Прототип це готове піддерево вузлів, яке вміє створити власну
// глибоку копію (clone). Нові вузли створюються не з нуля, а копіюванням зразка:
//   - «дублювати гілку»: прототипом стає наявна гілка карти (fromRows);
//   - «карта з шаблону»: прототипом стає зразок із реєстру шаблонів (TemplateRegistry).
// Копія повністю незалежна від оригіналу: зміна копії не торкається зразка, тож
// один шаблон можна розмножувати скільки завгодно.

const MAX_TEXT = 2000;
const MAX_NOTE = 10000;

export class NodePrototype {
  constructor({ text = '', collapsed = false, style = null, category = null, priority = null, note = null, children = [] } = {}) {
    this.text = text;
    this.collapsed = collapsed;
    this.style = style;
    this.category = category;
    this.priority = priority;
    this.note = note;
    this.children = children;
  }

  // Глибока копія: нові об'єкти на кожному рівні, в тому числі для style
  clone() {
    return new NodePrototype({
      text: this.text,
      collapsed: this.collapsed,
      style: this.style === null ? null : structuredClone(this.style),
      category: this.category,
      priority: this.priority,
      note: this.note,
      children: this.children.map((c) => c.clone()),
    });
  }

  size() {
    return 1 + this.children.reduce((sum, c) => sum + c.size(), 0);
  }

  // Прототип із гілки плоского списку вузлів БД
  static fromRows(rows, rootId) {
    const build = (row) =>
      new NodePrototype({
        text: row.text,
        collapsed: row.collapsed,
        style: row.style ?? null,
        category: row.category ?? null,
        priority: row.priority ?? null,
        note: row.note ?? null,
        children: childrenOf(rows, row.id).map(build),
      });
    return build(rows.find((r) => r.id === rootId));
  }

  // Зразок із вкладеного опису { text, category?, priority?, children?: [...] }
  static fromSnapshot(snap) {
    return new NodePrototype({
      text: snap.text,
      collapsed: snap.collapsed ?? false,
      style: snap.style ?? null,
      category: snap.category ?? null,
      priority: snap.priority ?? null,
      note: snap.note ?? null,
      children: (snap.children ?? []).map((c) => NodePrototype.fromSnapshot(c)),
    });
  }

  // Рядки для запису в БД: спершу батько, потім діти (щоб зовнішній ключ спрацював).
  // Корінь отримує вказаний parentId і order, решта вкладені за порядком.
  toRows({ mapId, parentId, order = 0, newId = randomUUID }) {
    const rows = [];
    const walk = (proto, parent, position) => {
      const id = newId();
      rows.push({
        id, mapId, parentId: parent, order: position,
        text: proto.text.slice(0, MAX_TEXT), collapsed: proto.collapsed,
        style: proto.style, category: proto.category, priority: proto.priority,
        note: proto.note === null ? null : proto.note.slice(0, MAX_NOTE),
      });
      proto.children.forEach((c, i) => walk(c, id, i));
    };
    walk(this, parentId, order);
    return rows;
  }
}

// Реєстр прототипів (Prototype Manager): клієнт просить копію за ключем
export class TemplateRegistry {
  #items = new Map();

  register(key, { title, description, prototype }) {
    if (this.#items.has(key)) throw new Error(`Шаблон «${key}» уже зареєстровано`);
    this.#items.set(key, { key, title, description, prototype });
    return this;
  }

  has(key) {
    return this.#items.has(key);
  }

  // Для списку на клієнті: без самих зразків
  list() {
    return [...this.#items.values()].map(({ key, title, description, prototype }) => ({
      key, title, description, nodes: prototype.size(),
    }));
  }

  // Копія зразка. Сам зразок ніхто не отримує, тож зіпсувати його неможливо.
  instantiate(key) {
    const item = this.#items.get(key);
    return item ? item.prototype.clone() : null;
  }
}
