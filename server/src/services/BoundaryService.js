import { badRequest, notFound } from '../errors.js';

export const MAX_BOUNDARIES_PER_MAP = 50;

// Сервіс (SOA): області карти. Область це підпис і набір id вузлів; малює її клієнт.
// Чужа карта чи область виглядають як неіснуючі (404).
export class BoundaryService {
  constructor({ mapRepository, nodeRepository, boundaryRepository }) {
    this.maps = mapRepository;
    this.nodes = nodeRepository;
    this.boundaries = boundaryRepository;
  }

  async #ownMap(ownerId, mapId) {
    const map = await this.maps.findBasic(mapId);
    if (!map || map.ownerId !== ownerId) throw notFound('Карту не знайдено');
  }

  async #ownBoundary(ownerId, mapId, id) {
    await this.#ownMap(ownerId, mapId);
    const boundary = await this.boundaries.findById(id);
    // область з іншої карти для цього URL теж «не знайдена»
    if (!boundary || boundary.mapId !== mapId) throw notFound('Область не знайдено');
    return boundary;
  }

  // Усі вузли мають бути з цієї ж карти; дублікати прибираємо
  async #checkNodes(mapId, nodeIds) {
    const unique = [...new Set(nodeIds)];
    const existing = new Set((await this.nodes.findByMap(mapId)).map((n) => n.id));
    if (unique.some((id) => !existing.has(id))) throw badRequest('Область містить вузли, яких немає на карті');
    return unique;
  }

  async create(ownerId, mapId, { label, nodeIds }) {
    await this.#ownMap(ownerId, mapId);
    if ((await this.boundaries.findByMap(mapId)).length >= MAX_BOUNDARIES_PER_MAP) {
      throw badRequest(`Ліміт областей на карті: ${MAX_BOUNDARIES_PER_MAP}`);
    }
    const ids = await this.#checkNodes(mapId, nodeIds);
    const boundary = await this.boundaries.create({ mapId, label, nodeIds: ids });
    await this.maps.touch(mapId);
    return boundary;
  }

  async update(ownerId, mapId, id, patch) {
    await this.#ownBoundary(ownerId, mapId, id);
    const data = { ...patch };
    if (patch.nodeIds) data.nodeIds = await this.#checkNodes(mapId, patch.nodeIds);
    const boundary = await this.boundaries.update(id, data);
    await this.maps.touch(mapId);
    return boundary;
  }

  async remove(ownerId, mapId, id) {
    await this.#ownBoundary(ownerId, mapId, id);
    await this.boundaries.delete(id);
    await this.maps.touch(mapId);
  }

  // Викликається, коли вузли видалено: вони зникають з областей, порожні області видаляються
  async forgetNodes(mapId, deletedIds) {
    const gone = new Set(deletedIds);
    for (const boundary of await this.boundaries.findByMap(mapId)) {
      const left = boundary.nodeIds.filter((id) => !gone.has(id));
      if (left.length === boundary.nodeIds.length) continue;
      if (left.length) await this.boundaries.update(boundary.id, { nodeIds: left });
      else await this.boundaries.delete(boundary.id);
    }
  }
}
