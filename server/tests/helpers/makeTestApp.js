import { createApp } from '../../src/app.js';
import { AuthService } from '../../src/services/AuthService.js';
import { BoundaryService } from '../../src/services/BoundaryService.js';
import { MapService } from '../../src/services/MapService.js';
import { NodeService } from '../../src/services/NodeService.js';
import { FakeBoundaryRepository, FakeMapRepository, FakeNodeRepository, FakeUserRepository } from './fakeRepositories.js';

export function makeTestApp() {
  const authService = new AuthService({
    userRepository: new FakeUserRepository(),
    jwtSecret: 'test-secret-test-secret-test-secret',
    jwtExpiresSeconds: 3600,
  });
  const mapRepository = new FakeMapRepository();
  const mapService = new MapService({ mapRepository });
  const nodeRepository = new FakeNodeRepository(mapRepository);
  const boundaryService = new BoundaryService({
    mapRepository,
    nodeRepository,
    boundaryRepository: new FakeBoundaryRepository(mapRepository),
  });
  const nodeService = new NodeService({ mapRepository, nodeRepository, boundaryService });
  return createApp({ authService, mapService, nodeService, boundaryService });
}
