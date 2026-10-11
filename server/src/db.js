import { PrismaClient } from '@prisma/client';

// Єдиний екземпляр клієнта Prisma на весь застосунок.
// Імпортується лише в server.js: сервіси отримують репозиторії ззовні,
// тому тести обходяться без бази даних.
export const prisma = new PrismaClient();
