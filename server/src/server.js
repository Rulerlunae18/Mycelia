import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { MapRepository } from './repositories/MapRepository.js';
import { UserRepository } from './repositories/UserRepository.js';
import { AuthService } from './services/AuthService.js';
import { MapService } from './services/MapService.js';

// Точка складання: репозиторії -> сервіси -> HTTP-застосунок.
const authService = new AuthService({
  userRepository: new UserRepository(prisma),
  jwtSecret: config.jwtSecret,
  jwtExpiresSeconds: config.jwtExpiresSeconds,
});
const mapService = new MapService({ mapRepository: new MapRepository(prisma) });

const app = createApp({ authService, mapService });
const server = app.listen(config.port, () => {
  console.log(`Mycelia API: http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
