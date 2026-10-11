import { notFound } from '../errors.js';

// Сервіс (SOA): карти користувача. Чужа карта для користувача
// виглядає так само, як неіснуюча (404), щоб не розкривати чужі id.
export class MapService {
  constructor({ mapRepository }) {
    this.maps = mapRepository;
  }

  list(ownerId) {
    return this.maps.listByOwner(ownerId);
  }

  // Нова карта завжди створюється разом із кореневим вузлом.
  create(ownerId, { title, theme, layout }) {
    return this.maps.createWithRoot({ ownerId, title, theme, layout });
  }

  async get(ownerId, id) {
    const map = await this.maps.findById(id);
    if (!map || map.ownerId !== ownerId) throw notFound('Карту не знайдено');
    return map;
  }

  async update(ownerId, id, patch) {
    await this.get(ownerId, id);
    return this.maps.update(id, patch);
  }

  async remove(ownerId, id) {
    await this.get(ownerId, id);
    await this.maps.delete(id);
  }
}
