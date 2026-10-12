import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

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
  attachmentRepository = null; // підставляється в makeTestApp, щоб карта віддавала вкладення вузлів

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
    const map = this.maps.find((m) => m.id === id);
    if (!map) return null;
    // як Prisma include: вкладення лежать усередині вузлів
    return {
      ...map,
      nodes: map.nodes.map((n) => ({
        ...n,
        attachments: (this.attachmentRepository?.items ?? []).filter((a) => a.nodeId === n.id),
      })),
    };
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

  async createMany(rows) {
    const full = rows.map((r) => ({ ...newNode(r), ...r }));
    this.#map(rows[0].mapId).nodes.push(...full);
    return full.map((n) => ({ ...n, attachments: [] }));
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

export class FakeAttachmentRepository {
  items = [];

  constructor(mapRepository) {
    this.mapRepository = mapRepository;
  }

  #mapIdOf(nodeId) {
    return this.mapRepository.maps.find((m) => m.nodes.some((n) => n.id === nodeId))?.id ?? null;
  }

  async findById(id) {
    const a = this.items.find((x) => x.id === id);
    return a ? { ...a, node: { mapId: this.#mapIdOf(a.nodeId) } } : null;
  }

  async countByNode(nodeId) {
    return this.items.filter((a) => a.nodeId === nodeId).length;
  }

  async countByMap(mapId) {
    return this.items.filter((a) => this.#mapIdOf(a.nodeId) === mapId).length;
  }

  async findByNodes(nodeIds) {
    return this.items.filter((a) => nodeIds.includes(a.nodeId)).map((a) => ({ ...a }));
  }

  async findByMap(mapId) {
    return this.items.filter((a) => this.#mapIdOf(a.nodeId) === mapId).map((a) => ({ ...a }));
  }

  async create(data) {
    const item = { id: randomUUID(), createdAt: new Date(), ...data };
    this.items.push(item);
    return { ...item };
  }

  async delete(id) {
    this.items = this.items.filter((a) => a.id !== id);
  }
}

// Сховище в пам'яті: той самий інтерфейс, що й LocalDiskStorage
export class FakeStorage {
  files = new Map();

  async put(key, buffer) {
    this.files.set(key, Buffer.from(buffer));
  }

  async size(key) {
    return this.files.has(key) ? this.files.get(key).length : null;
  }

  read(key, { start = 0, end } = {}) {
    const buf = this.files.get(key);
    return Readable.from([buf.subarray(start, end === undefined ? undefined : end + 1)]);
  }

  async remove(key) {
    this.files.delete(key);
  }
}
