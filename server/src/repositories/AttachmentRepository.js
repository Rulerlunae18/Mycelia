export class AttachmentRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findById(id) {
    return this.prisma.attachment.findUnique({ where: { id }, include: { node: { select: { mapId: true } } } });
  }

  countByNode(nodeId) {
    return this.prisma.attachment.count({ where: { nodeId } });
  }

  countByMap(mapId) {
    return this.prisma.attachment.count({ where: { node: { mapId } } });
  }

  findByNodes(nodeIds) {
    return this.prisma.attachment.findMany({ where: { nodeId: { in: nodeIds } } });
  }

  findByMap(mapId) {
    return this.prisma.attachment.findMany({ where: { node: { mapId } } });
  }

  create({ nodeId, kind, name, mime, size, storageKey }) {
    return this.prisma.attachment.create({ data: { nodeId, kind, name, mime, size, storageKey } });
  }

  async delete(id) {
    await this.prisma.attachment.delete({ where: { id } });
  }
}
