import { createApp } from '../../src/app.js';
import { AuthService } from '../../src/services/AuthService.js';
import { buildTemplateRegistry } from '../../src/domain/templates.js';
import { TemplateService } from '../../src/services/TemplateService.js';
import { AttachmentService } from '../../src/services/AttachmentService.js';
import { BoundaryService } from '../../src/services/BoundaryService.js';
import { LinkService } from '../../src/services/LinkService.js';
import { MapService } from '../../src/services/MapService.js';
import { NodeService } from '../../src/services/NodeService.js';
import { FakeAttachmentRepository, FakeBoundaryRepository, FakeLinkRepository, FakeStorage, FakeMapRepository, FakeNodeRepository, FakeUserRepository } from './fakeRepositories.js';

// storage можно подсмотреть в тестах: app.locals.storage
export function makeTestApp({ maxLinks, clientDist } = {}) {
  const authService = new AuthService({
    userRepository: new FakeUserRepository(),
    jwtSecret: 'test-secret-test-secret-test-secret',
    jwtExpiresSeconds: 3600,
  });
  const mapRepository = new FakeMapRepository();
  const nodeRepository = new FakeNodeRepository(mapRepository);
  const attachmentRepository = new FakeAttachmentRepository(mapRepository);
  mapRepository.attachmentRepository = attachmentRepository;
  const storage = new FakeStorage();
  const attachmentService = new AttachmentService({ mapRepository, nodeRepository, attachmentRepository, storage });
  const mapService = new MapService({ mapRepository, attachmentService });
  const boundaryService = new BoundaryService({
    mapRepository,
    nodeRepository,
    boundaryRepository: new FakeBoundaryRepository(mapRepository),
  });
  const linkService = new LinkService({ mapRepository, nodeRepository, linkRepository: new FakeLinkRepository(mapRepository), maxLinks });
  const nodeService = new NodeService({ mapRepository, nodeRepository, boundaryService, attachmentService });
  const templateService = new TemplateService({ mapRepository, nodeRepository, registry: buildTemplateRegistry() });
  const app = createApp({ authService, mapService, nodeService, boundaryService, linkService, attachmentService, templateService, clientDist });
  app.locals.storage = storage;
  return app;
}
