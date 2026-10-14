import { badRequest, notFound } from '../errors.js';

export const MAX_LINKS_PER_MAP = 500;

// Сервіс (SOA): зв'язки між вузлами. Зв'язок це стрілка «від → до» поза деревом; малює її клієнт.
// Чужа карта чи зв'язок виглядають як неіснуючі (404). Разом із вузлом зв'язок зникає сам (каскад у БД).
export class LinkService {
  constructor({ mapRepository, nodeRepository, linkRepository, maxLinks = MAX_LINKS_PER_MAP }) {
    this.maps = mapRepository;
    this.nodes = nodeRepository;
    this.links = linkRepository;
    this.maxLinks = maxLinks;
  }

  async #ownMap(ownerId, mapId) {
    const map = await this.maps.findBasic(mapId);
    if (!map || map.ownerId !== ownerId) throw notFound('Карту не знайдено');
  }

  async #ownLink(ownerId, mapId, id) {
    await this.#ownMap(ownerId, mapId);
    const link = await this.links.findById(id);
    // зв'язок з іншої карти для цього URL теж «не знайдений»
    if (!link || link.mapId !== mapId) throw notFound('Зв\'язок не знайдено');
    return link;
  }

  // Порожній підпис означає «без підпису»
  static #label(label) {
    const text = (label ?? '').trim();
    return text || null;
  }

  async create(ownerId, mapId, { fromId, toId, label }) {
    await this.#ownMap(ownerId, mapId);
    if (fromId === toId) throw badRequest('Вузол не можна зв\'язати із самим собою');
    const ids = new Set((await this.nodes.findByMap(mapId)).map((n) => n.id));
    if (!ids.has(fromId) || !ids.has(toId)) throw badRequest('Обидва вузли мають бути на цій карті');
    const existing = await this.links.findByMap(mapId);
    if (existing.length >= this.maxLinks) throw badRequest(`Ліміт зв'язків на карті: ${this.maxLinks}`);
    if (existing.some((l) => l.fromId === fromId && l.toId === toId)) throw badRequest('Такий зв\'язок уже є');
    const link = await this.links.create({ mapId, fromId, toId, label: LinkService.#label(label) });
    await this.maps.touch(mapId);
    return link;
  }

  async update(ownerId, mapId, id, { label }) {
    await this.#ownLink(ownerId, mapId, id);
    const link = await this.links.update(id, { label: LinkService.#label(label) });
    await this.maps.touch(mapId);
    return link;
  }

  async remove(ownerId, mapId, id) {
    await this.#ownLink(ownerId, mapId, id);
    await this.links.delete(id);
    await this.maps.touch(mapId);
  }
}
