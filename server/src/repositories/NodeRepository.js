export class NodeRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByMap(mapId) {
    return this.prisma.node.findMany({ where: { mapId }, orderBy: { order: 'asc' } });
  }

  create({ mapId, parentId, text, order }) {
    return this.prisma.node.create({ data: { mapId, parentId, text, order } });
  }

  // Масове створення вузлів із готовими id (спершу батьки, потім діти) однією транзакцією
  // style: null опускаємо: Prisma не приймає звичайний null у JSON-полі (потрібен Prisma.JsonNull),
  // а відсутнє поле і так збережеться як NULL.
  async createMany(rows) {
    if (!rows.length) return [];
    const data = rows.map(({ style, ...rest }) => (style == null ? rest : { ...rest, style }));
    await this.prisma.$transaction([this.prisma.node.createMany({ data })]);
    return rows.map((r) => ({ ...r, attachments: [] }));
  }

  update(id, data) {
    return this.prisma.node.update({ where: { id }, data });
  }

  // Усі оновлення позицій однією транзакцією: або всі, або жодне
  async saveOrder(changes) {
    if (!changes.length) return;
    await this.prisma.$transaction(
      changes.map(({ id, parentId, order }) =>
        this.prisma.node.update({ where: { id }, data: { parentId, order } }),
      ),
    );
  }

  // Видаляє вузли по одному, від листків до кореня піддерева. Так кожне
  // видалення не запускає каскад: MySQL обмежував самопосилання 15 рівнями, і глибока гілка
  // інакше не видалилася б. На PostgreSQL це не потрібно, але лишається безпечним.
  async deleteLeafFirst(ids) {
    await this.prisma.$transaction(ids.map((id) => this.prisma.node.delete({ where: { id } })));
  }
}
