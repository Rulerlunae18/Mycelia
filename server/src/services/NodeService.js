import { badRequest, notFound } from '../errors.js';
import { NodePrototype } from '../domain/prototype.js';
import { childrenOf, clamp, insertAt, reindex, subtreeIds } from '../domain/tree.js';

export const MAX_NODES_PER_MAP = 2000;

// Сервіс (SOA): вузли карти. Усі операції спершу перевіряють, що карта
// належить користувачеві, і вже потім працюють із деревом.
export class NodeService {
  constructor({ mapRepository, nodeRepository, boundaryService = null, attachmentService = null }) {
    this.maps = mapRepository;
    this.nodes = nodeRepository;
    this.attachmentService = attachmentService; // стирає файли вкладень видалених вузлів
    this.boundaryService = boundaryService; // чистить області від видалених вузлів
  }

  async #load(ownerId, mapId) {
    const map = await this.maps.findBasic(mapId);
    if (!map || map.ownerId !== ownerId) throw notFound('Карту не знайдено');
    return this.nodes.findByMap(mapId);
  }

  #find(nodes, id, message = 'Вузол не знайдено') {
    const node = nodes.find((n) => n.id === id);
    if (!node) throw notFound(message);
    return node;
  }

  async create(ownerId, mapId, { parentId, text, index }) {
    const nodes = await this.#load(ownerId, mapId);
    if (nodes.length >= MAX_NODES_PER_MAP) {
      throw badRequest(`Ліміт вузлів на карті: ${MAX_NODES_PER_MAP}`);
    }
    this.#find(nodes, parentId, 'Батьківський вузол не знайдено');

    const siblings = childrenOf(nodes, parentId).map((n) => n.id);
    const position = clamp(index ?? siblings.length, 0, siblings.length);
    const node = await this.nodes.create({ mapId, parentId, text, order: position });

    // Якщо вставили не в кінець, зсуваємо сусідів
    if (position < siblings.length) {
      await this.nodes.saveOrder(reindex(insertAt(siblings, node.id, position), parentId));
    }
    await this.maps.touch(mapId);
    return { ...node, order: position };
  }

  async update(ownerId, mapId, nodeId, patch) {
    const nodes = await this.#load(ownerId, mapId);
    this.#find(nodes, nodeId);
    const node = await this.nodes.update(nodeId, patch);
    await this.maps.touch(mapId);
    return node;
  }

  // Повертає список змінених позицій { id, parentId, order }, щоб клієнт
  // міг синхронізувати своє дерево без повторного завантаження карти.
  async move(ownerId, mapId, nodeId, { parentId, index }) {
    const nodes = await this.#load(ownerId, mapId);
    const node = this.#find(nodes, nodeId);
    if (node.parentId === null) throw badRequest('Корінь карти не можна переміщувати');
    this.#find(nodes, parentId, 'Новий батьківський вузол не знайдено');
    if (subtreeIds(nodes, nodeId).includes(parentId)) {
      throw badRequest('Не можна перемістити вузол у власне піддерево');
    }

    const oldParentId = node.parentId;
    const oldSiblings = childrenOf(nodes, oldParentId)
      .map((n) => n.id)
      .filter((id) => id !== nodeId);
    const targetSiblings =
      oldParentId === parentId ? oldSiblings : childrenOf(nodes, parentId).map((n) => n.id);
    const position = clamp(index ?? targetSiblings.length, 0, targetSiblings.length);

    const changes = reindex(insertAt(targetSiblings, nodeId, position), parentId);
    if (oldParentId !== parentId) changes.push(...reindex(oldSiblings, oldParentId));

    await this.nodes.saveOrder(changes);
    await this.maps.touch(mapId);
    return changes;
  }

  // Дублює гілку (Prototype): гілка стає прототипом, копія з'являється одразу після оригіналу.
  // Вкладення не копіюються (файли не розмножуємо), області теж.
  async duplicate(ownerId, mapId, nodeId) {
    const nodes = await this.#load(ownerId, mapId);
    const node = this.#find(nodes, nodeId);
    if (node.parentId === null) throw badRequest('Корінь карти не можна дублювати');

    const copy = NodePrototype.fromRows(nodes, nodeId).clone();
    if (nodes.length + copy.size() > MAX_NODES_PER_MAP) {
      throw badRequest(`Ліміт вузлів на карті: ${MAX_NODES_PER_MAP}`);
    }
    copy.text = `${node.text} (копія)`.slice(0, 2000);

    const siblings = childrenOf(nodes, node.parentId).map((n) => n.id);
    const position = siblings.indexOf(nodeId) + 1;
    const rows = copy.toRows({ mapId, parentId: node.parentId, order: position });
    const created = await this.nodes.createMany(rows);

    const changes = reindex(insertAt(siblings, rows[0].id, position), node.parentId);
    await this.nodes.saveOrder(changes);
    await this.maps.touch(mapId);
    return { nodes: created.map((n) => ({ ...n, order: changes.find((c) => c.id === n.id)?.order ?? n.order })), changes };
  }

  async remove(ownerId, mapId, nodeId) {
    const nodes = await this.#load(ownerId, mapId);
    const node = this.#find(nodes, nodeId);
    if (node.parentId === null) throw badRequest('Корінь карти не можна видалити');

    const deleted = subtreeIds(nodes, nodeId);
    // Спершу листки, потім батьки (див. NodeRepository.deleteLeafFirst)
    const fileKeys = (await this.attachmentService?.keysForNodes(deleted)) ?? [];
    await this.nodes.deleteLeafFirst([...deleted].reverse());
    await this.attachmentService?.dropFiles(fileKeys);

    const siblings = childrenOf(nodes, node.parentId)
      .map((n) => n.id)
      .filter((id) => id !== nodeId);
    const changes = reindex(siblings, node.parentId);
    await this.nodes.saveOrder(changes);
    await this.boundaryService?.forgetNodes(mapId, deleted);
    await this.maps.touch(mapId);
    return { deleted, changes };
  }
}
