// Єдине місце, де код знає про Prisma для користувачів.
// Зміна СУБД торкається лише schema.prisma, а не цього шару.
export class UserRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByEmail(email) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create({ email, passwordHash }) {
    return this.prisma.user.create({ data: { email, passwordHash } });
  }
}
