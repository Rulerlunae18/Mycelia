import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { BoundaryRepository } from './repositories/BoundaryRepository.js';
import { MapRepository } from './repositories/MapRepository.js';
import { NodeRepository } from './repositories/NodeRepository.js';
import { UserRepository } from './repositories/UserRepository.js';
import { AuthService } from './services/AuthService.js';
import { BoundaryService } from './services/BoundaryService.js';
import { MapService } from './services/MapService.js';
import { NodeService } from './services/NodeService.js';

// Точка складання: репозиторії -> сервіси -> HTTP-застосунок.
const authService = new AuthService({
  userRepository: new UserRepository(prisma),
  jwtSecret: config.jwtSecret,
  jwtExpiresSeconds: config.jwtExpiresSeconds,
});
const mapRepository = new MapRepository(prisma);
const mapService = new MapService({ mapRepository });
const nodeRepository = new NodeRepository(prisma);
const boundaryService = new BoundaryService({
  mapRepository,
  nodeRepository,
  boundaryRepository: new BoundaryRepository(prisma),
});
const nodeService = new NodeService({ mapRepository, nodeRepository, boundaryService });

const app = createApp({ authService, mapService, nodeService, boundaryService });
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
