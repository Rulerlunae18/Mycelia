import { createApp } from '../../src/app.js';
import { AuthService } from '../../src/services/AuthService.js';
import { MapService } from '../../src/services/MapService.js';
import { FakeMapRepository, FakeUserRepository } from './fakeRepositories.js';

export function makeTestApp() {
  const authService = new AuthService({
    userRepository: new FakeUserRepository(),
    jwtSecret: 'test-secret-test-secret-test-secret',
    jwtExpiresSeconds: 3600,
  });
  const mapService = new MapService({ mapRepository: new FakeMapRepository() });
  return createApp({ authService, mapService });
}
