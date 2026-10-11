// Ядро предметної області: патерн Composite.
// Без залежностей від Vue і браузера, тому тестується звичайним Vitest.
//
// Лист і гілка тут один клас: вузол карти під час редагування постійно
// змінює роль (додали дитину, видалили останню), тому окремі Leaf і
// Branch були б штучними. Операції size(), walk(), moveTo() однаково
// працюють для вузла і для цілого піддерева.

export class TreeNode {
  constructor({ id, text = '', collapsed = false, ...extra } = {}) {
    this.id = id;
    this.text = text;
    this.collapsed = collapsed;
    this.extra = extra; // style, category, priority, order... не потрібні ядру
    this.children = [];
    this.parent = null;
  }

  get isRoot() {
    return this.parent === null;
  }

  get isLeaf() {
    return this.children.length === 0;
  }

  get depth() {
    let d = 0;
    for (let n = this.parent; n; n = n.parent) d += 1;
    return d;
  }

  // Чи є node цим вузлом або його нащадком
  contains(node) {
    for (let n = node; n; n = n.parent) if (n === this) return true;
    return false;
  }

  add(child, index = this.children.length) {
    if (child.contains(this)) {
      throw new Error('Не можна зробити вузол нащадком самого себе');
    }
    child.parent?.remove(child);
    this.children.splice(index, 0, child);
    child.parent = this;
    return child;
  }

  remove(child) {
    const i = this.children.indexOf(child);
    if (i === -1) return false;
    this.children.splice(i, 1);
    child.parent = null;
    return true;
  }

  // Переміщення вузла разом із піддеревом під нового батька
  moveTo(newParent, index) {
    if (this.isRoot) throw new Error('Корінь карти не можна переміщувати');
    return newParent.add(this, index);
  }

  // Обхід у глибину, спершу вузол, потім діти
  *walk() {
    yield this;
    for (const child of this.children) yield* child.walk();
  }

  // Кількість вузлів у піддереві, включно з цим
  size() {
    return 1 + this.children.reduce((sum, c) => sum + c.size(), 0);
  }

  // Кількість вузлів, видимих на полотні: нащадки згорнутих гілок не рахуються
  visibleSize() {
    if (this.collapsed) return 1;
    return 1 + this.children.reduce((sum, c) => sum + c.visibleSize(), 0);
  }

  find(id) {
    for (const node of this.walk()) if (node.id === id) return node;
    return null;
  }

  toggle() {
    this.collapsed = !this.collapsed;
  }

  // Будує дерево з плоского списку рядків БД: { id, parentId, order, ... }
  static fromFlat(rows) {
    const byId = new Map(rows.map((r) => [r.id, new TreeNode(r)]));
    let root = null;
    const sorted = [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const row of sorted) {
      const node = byId.get(row.id);
      if (row.parentId == null) {
        root ??= node;
      } else {
        byId.get(row.parentId)?.add(node);
      }
    }
    return root;
  }
}
