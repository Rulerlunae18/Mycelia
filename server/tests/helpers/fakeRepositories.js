import { randomUUID } from 'node:crypto';

// Репозиторії в пам'яті: ті самі методи, що й у Prisma-версій.
export class FakeUserRepository {
  users = [];

  async findByEmail(email) {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async create({ email, passwordHash }) {
    const user = { id: randomUUID(), email, passwordHash, createdAt: new Date() };
    this.users.push(user);
    return user;
  }
}

export class FakeMapRepository {
  maps = [];

  async listByOwner(ownerId) {
    return this.maps.filter((m) => m.ownerId === ownerId).map(({ nodes, ...rest }) => rest);
  }

  async createWithRoot({ ownerId, title, theme, layout }) {
    const id = randomUUID();
    const map = {
      id,
      ownerId,
      title,
      theme: theme ?? 'default',
      layout: layout ?? 'radial',
      createdAt: new Date(),
      updatedAt: new Date(),
      nodes: [newNode({ mapId: id, parentId: null, text: title, order: 0 })],
      boundaries: [],
    };
    this.maps.push(map);
    return map;
  }

  async findById(id) {
    return this.maps.find((m) => m.id === id) ?? null;
  }

  async findBasic(id) {
    const map = this.maps.find((m) => m.id === id);
    return map ? { id: map.id, ownerId: map.ownerId } : null;
  }

  async touch(id) {
    const map = this.maps.find((m) => m.id === id);
    if (map) map.updatedAt = new Date();
  }

  async update(id, patch) {
    const map = this.maps.find((m) => m.id === id);
    Object.assign(map, patch, { updatedAt: new Date() });
    return map;
  }

  async delete(id) {
    this.maps = this.maps.filter((m) => m.id !== id);
  }
}

function newNode({ mapId, parentId, text, order }) {
  return {
    id: randomUUID(),
    mapId,
    parentId,
    text,
    order,
    collapsed: false,
    style: null,
    category: null,
    priority: null,
  };
}

// Працює з тими самими картами, що й FakeMapRepository
export class FakeNodeRepository {
  constructor(mapRepository) {
    this.mapRepository = mapRepository;
  }

  #map(mapId) {
    return this.mapRepository.maps.find((m) => m.id === mapId);
  }

  #findNode(id) {
    for (const map of this.mapRepository.maps) {
      const node = map.nodes.find((n) => n.id === id);
      if (node) return node;
    }
    return null;
  }

  async findByMap(mapId) {
    return this.#map(mapId).nodes.map((n) => ({ ...n }));
  }

  async create({ mapId, parentId, text, order }) {
    const node = newNode({ mapId, parentId, text, order });
    this.#map(mapId).nodes.push(node);
    return { ...node };
  }

  async update(id, data) {
    const node = this.#findNode(id);
    Object.assign(node, data);
    return { ...node };
  }

  async saveOrder(changes) {
    for (const { id, parentId, order } of changes) {
      Object.assign(this.#findNode(id), { parentId, order });
    }
  }

  async deleteLeafFirst(ids) {
    for (const map of this.mapRepository.maps) {
      map.nodes = map.nodes.filter((n) => !ids.includes(n.id));
    }
  }
}

export class FakeBoundaryRepository {
  constructor(mapRepository) {
    this.mapRepository = mapRepository;
  }

  #all() {
    return this.mapRepository.maps.flatMap((m) => m.boundaries);
  }

  async findByMap(mapId) {
    return this.mapRepository.maps.find((m) => m.id === mapId).boundaries.map((b) => ({ ...b }));
  }

  async findById(id) {
    const b = this.#all().find((x) => x.id === id);
    return b ? { ...b } : null;
  }

  async create({ mapId, label, nodeIds }) {
    const boundary = { id: randomUUID(), mapId, label, nodeIds };
    this.mapRepository.maps.find((m) => m.id === mapId).boundaries.push(boundary);
    return { ...boundary };
  }

  async update(id, data) {
    const b = this.#all().find((x) => x.id === id);
    Object.assign(b, data);
    return { ...b };
  }

  async delete(id) {
    for (const map of this.mapRepository.maps) map.boundaries = map.boundaries.filter((b) => b.id !== id);
  }
}
