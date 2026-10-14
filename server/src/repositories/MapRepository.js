export class MapRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listByOwner(ownerId) {
    return this.prisma.mindMap.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, theme: true, layout: true, createdAt: true, updatedAt: true },
    });
  }

  createWithRoot({ ownerId, title, theme, layout }) {
    return this.prisma.mindMap.create({
      data: {
        ownerId,
        title,
        ...(theme && { theme }),
        ...(layout && { layout }),
        nodes: { create: { text: title, order: 0 } },
      },
      include: { nodes: true },
    });
  }

  findById(id) {
    return this.prisma.mindMap.findUnique({
      where: { id },
      include: {
        nodes: { orderBy: { order: 'asc' }, include: { attachments: true } },
        boundaries: true,
        links: true,
      },
    });
  }

  // Лише id і власник: для перевірки доступу без завантаження всіх вузлів
  findBasic(id) {
    return this.prisma.mindMap.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  }

  // Оновлює updatedAt після змін вузлів, щоб карта піднімалась у списку
  async touch(id) {
    await this.prisma.mindMap.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  update(id, patch) {
    return this.prisma.mindMap.update({ where: { id }, data: patch });
  }

  async delete(id) {
    await this.prisma.mindMap.delete({ where: { id } });
  }
}
