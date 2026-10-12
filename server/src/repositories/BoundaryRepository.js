export class BoundaryRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByMap(mapId) {
    return this.prisma.boundary.findMany({ where: { mapId }, orderBy: { id: 'asc' } });
  }

  findById(id) {
    return this.prisma.boundary.findUnique({ where: { id } });
  }

  create({ mapId, label, nodeIds }) {
    return this.prisma.boundary.create({ data: { mapId, label, nodeIds } });
  }

  update(id, data) {
    return this.prisma.boundary.update({ where: { id }, data });
  }

  async delete(id) {
    await this.prisma.boundary.delete({ where: { id } });
  }
}
