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
      nodes: [{ id: randomUUID(), mapId: id, parentId: null, text: title, order: 0 }],
    };
    this.maps.push(map);
    return map;
  }

  async findById(id) {
    return this.maps.find((m) => m.id === id) ?? null;
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
