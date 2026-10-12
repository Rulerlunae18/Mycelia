import { randomUUID } from 'node:crypto';
import { badRequest } from '../errors.js';
import { DEFAULT_LAYOUT, DEFAULT_THEME } from './MapService.js';

// Сервіс (SOA): шаблони карт. Нова карта з шаблону створюється копіюванням зразка (Prototype).
export class TemplateService {
  constructor({ mapRepository, nodeRepository, registry, newId = randomUUID }) {
    this.maps = mapRepository;
    this.nodes = nodeRepository;
    this.registry = registry;
    this.newId = newId;
  }

  list() {
    return this.registry.list();
  }

  async createMap(ownerId, { title, theme, layout, template }) {
    const copy = this.registry.instantiate(template);
    if (!copy) throw badRequest('Невідомий шаблон');

    // Корінь уже є (його створює карта), тож нові вузли це діти зразка під ним
    // те саме умовчання, що й у MapService: інакше спрацюють значення за замовчуванням зі схеми БД
    const map = await this.maps.createWithRoot({
      ownerId, title, theme: theme ?? DEFAULT_THEME, layout: layout ?? DEFAULT_LAYOUT,
    });
    const root = map.nodes[0];
    const rootId = root.id;
    const rows = copy.children.flatMap((child, order) =>
      child.toRows({ mapId: map.id, parentId: rootId, order, newId: this.newId }),
    );
    const created = await this.nodes.createMany(rows);
    return { ...map, nodes: [root, ...created] };
  }
}
