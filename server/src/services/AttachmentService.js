import { randomUUID } from 'node:crypto';
import { badRequest, notFound } from '../errors.js';
import {
  classify,
  MAX_ATTACHMENTS_PER_MAP,
  MAX_ATTACHMENTS_PER_NODE,
  MAX_FILE_BYTES,
  sanitizeName,
} from '../domain/files.js';

// Для клієнта: без storageKey (внутрішня деталь сховища)
export const toPublic = ({ id, nodeId, kind, name, mime, size, createdAt }) => ({
  id, nodeId, kind, name, mime, size, createdAt,
});

// Сервіс (SOA): вкладення вузлів. Сам файл лежить у сховищі (Strategy), у БД лише опис.
export class AttachmentService {
  constructor({ mapRepository, nodeRepository, attachmentRepository, storage }) {
    this.maps = mapRepository;
    this.nodes = nodeRepository;
    this.attachments = attachmentRepository;
    this.storage = storage;
  }

  async #ownMap(ownerId, mapId) {
    const map = await this.maps.findBasic(mapId);
    if (!map || map.ownerId !== ownerId) throw notFound('Карту не знайдено');
  }

  // Вкладення з іншої карти для цього URL «не знайдено»
  async #own(ownerId, mapId, id) {
    await this.#ownMap(ownerId, mapId);
    const attachment = await this.attachments.findById(id);
    if (!attachment || attachment.node.mapId !== mapId) throw notFound('Вкладення не знайдено');
    return attachment;
  }

  async add(ownerId, mapId, nodeId, { name, mime, buffer }) {
    await this.#ownMap(ownerId, mapId);
    const nodes = await this.nodes.findByMap(mapId);
    if (!nodes.some((n) => n.id === nodeId)) throw notFound('Вузол не знайдено');
    if (!buffer?.length) throw badRequest('Файл порожній');
    if (buffer.length > MAX_FILE_BYTES) throw badRequest('Файл занадто великий');
    if ((await this.attachments.countByNode(nodeId)) >= MAX_ATTACHMENTS_PER_NODE) {
      throw badRequest(`Ліміт вкладень на вузлі: ${MAX_ATTACHMENTS_PER_NODE}`);
    }
    if ((await this.attachments.countByMap(mapId)) >= MAX_ATTACHMENTS_PER_MAP) {
      throw badRequest(`Ліміт вкладень на карті: ${MAX_ATTACHMENTS_PER_MAP}`);
    }

    const { kind, mime: safeMime } = classify(mime, buffer);
    const storageKey = `${mapId}/${randomUUID()}`;
    await this.storage.put(storageKey, buffer);
    try {
      const created = await this.attachments.create({
        nodeId, kind, name: sanitizeName(name), mime: safeMime, size: buffer.length, storageKey,
      });
      await this.maps.touch(mapId);
      return toPublic(created);
    } catch (err) {
      await this.storage.remove(storageKey).catch(() => {}); // не лишаємо файл-сироту
      throw err;
    }
  }

  // Для маршруту завантаження: опис і доступ до байтів
  async open(ownerId, mapId, id) {
    const a = await this.#own(ownerId, mapId, id);
    const size = await this.storage.size(a.storageKey);
    if (size === null) throw notFound('Файл не знайдено у сховищі');
    return { meta: toPublic(a), size, read: (range) => this.storage.read(a.storageKey, range) };
  }

  async remove(ownerId, mapId, id) {
    const a = await this.#own(ownerId, mapId, id);
    await this.attachments.delete(id);
    await this.storage.remove(a.storageKey).catch(() => {});
    await this.maps.touch(mapId);
  }

  // Ключі файлів вузлів і всієї карти збираємо ДО видалення з БД (після нього рядків уже немає),
  // а самі файли стираємо ПІСЛЯ: якщо БД відмовила, файли не втрачено.
  async keysForNodes(nodeIds) {
    return (await this.attachments.findByNodes(nodeIds)).map((a) => a.storageKey);
  }

  async keysForMap(mapId) {
    return (await this.attachments.findByMap(mapId)).map((a) => a.storageKey);
  }

  async dropFiles(keys) {
    await Promise.all(keys.map((k) => this.storage.remove(k).catch(() => {})));
  }
}
