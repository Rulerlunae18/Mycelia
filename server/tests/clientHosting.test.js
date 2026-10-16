import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/makeTestApp.js';

// Продакшен: один сервер віддає і API, і зібраний клієнт
function fakeDist() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mycelia-dist-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="app"></div>');
  writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
  return dir;
}

describe('роздача клієнта з сервера', () => {
  const app = makeTestApp({ clientDist: fakeDist() });

  it('віддає index.html на кореневу і на «клієнтські» адреси (SPA)', async () => {
    for (const url of ['/', '/maps', '/maps/abc-123', '/login']) {
      const res = await request(app).get(url).expect(200);
      expect(res.text).toContain('<div id="app">');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('файли з assets кешуються надовго', async () => {
    const res = await request(app).get('/assets/app-abc123.js').expect(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('невідома адреса API лишається JSON-помилкою, а не сторінкою', async () => {
    const res = await request(app).get('/api/nothing-here').expect(404);
    expect(res.headers['content-type']).toContain('json');
    expect((await request(app).get('/api/health').expect(200)).body).toEqual({ status: 'ok' });
  });

  it('CSP дозволяє blob: для картинок і відео, але не чужі скрипти', async () => {
    const csp = (await request(app).get('/')).headers['content-security-policy'];
    expect(csp).toMatch(/img-src 'self' data: blob:/);
    expect(csp).toMatch(/media-src 'self' blob:/);
    expect(csp).toMatch(/script-src 'self'(;|$)/);
  });

  it('без зібраного клієнта (розробка, тести) сервер лишається чистим API', async () => {
    const bare = makeTestApp();
    await request(bare).get('/').expect(404);
    await request(makeTestApp({ clientDist: '/no/such/dir' })).get('/maps').expect(404);
  });
});
