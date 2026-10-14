export class LinkRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByMap(mapId) {
    return this.prisma.link.findMany({ where: { mapId }, orderBy: { id: 'asc' } });
  }

  findById(id) {
    return this.prisma.link.findUnique({ where: { id } });
  }

  findPair(fromId, toId) {
    return this.prisma.link.findUnique({ where: { fromId_toId: { fromId, toId } } });
  }

  create({ mapId, fromId, toId, label }) {
    return this.prisma.link.create({ data: { mapId, fromId, toId, label } });
  }

  update(id, data) {
    return this.prisma.link.update({ where: { id }, data });
  }

  async delete(id) {
    await this.prisma.link.delete({ where: { id } });
  }
}
