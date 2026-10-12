import { notFound } from '../errors.js';
import { toPublic } from './AttachmentService.js';

// Розкладка нової карти, якщо користувач не вибрав її сам. Задаємо тут, а не в
// schema.prisma, щоб зміна не вимагала міграції; збігається з DEFAULT_LAYOUT клієнта.
export const DEFAULT_LAYOUT = 'bilateral';
export const DEFAULT_THEME = 'forest';

// Сервіс (SOA): карти користувача. Чужа карта для користувача
// виглядає так само, як неіснуюча (404), щоб не розкривати чужі id.
export class MapService {
  constructor({ mapRepository, attachmentService = null }) {
    this.maps = mapRepository;
    this.attachmentService = attachmentService; // чистить файли видаленої карти
  }

  list(ownerId) {
    return this.maps.listByOwner(ownerId);
  }

  // Нова карта завжди створюється разом із кореневим вузлом.
  create(ownerId, { title, theme, layout }) {
    return this.maps.createWithRoot({ ownerId, title, theme: theme ?? DEFAULT_THEME, layout: layout ?? DEFAULT_LAYOUT });
  }

  async get(ownerId, id) {
    const map = await this.maps.findById(id);
    if (!map || map.ownerId !== ownerId) throw notFound('Карту не знайдено');
    // storageKey (внутрішній ключ сховища) клієнту не віддаємо
    return {
      ...map,
      nodes: map.nodes?.map((n) => ({ ...n, attachments: (n.attachments ?? []).map(toPublic) })),
    };
  }

  async update(ownerId, id, patch) {
    await this.get(ownerId, id);
    return this.maps.update(id, patch);
  }

  async remove(ownerId, id) {
    await this.get(ownerId, id);
    const keys = (await this.attachmentService?.keysForMap(id)) ?? [];
    await this.maps.delete(id);
    await this.attachmentService?.dropFiles(keys);
  }
}
