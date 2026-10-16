import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config.js';
import { makeRequireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { attachmentRoutes } from './routes/attachments.routes.js';
import { boundaryRoutes } from './routes/boundaries.routes.js';
import { linkRoutes } from './routes/links.routes.js';
import { mapRoutes } from './routes/maps.routes.js';
import { nodeRoutes } from './routes/nodes.routes.js';

// Фабрика застосунку: сервіси приходять ззовні (dependency injection).
// У server.js вони працюють із Prisma, у тестах із фейковими репозиторіями.
export function createApp({ authService, mapService, nodeService, boundaryService, linkService, attachmentService, templateService, clientDist = null }) {
  const app = express();

  // Render стоїть за проксі: потрібно для rate limit і Secure-cookie
  app.set('trust proxy', 1);

  // Стандартний захист helmet; додатково дозволено blob: для картинок (експорт PNG) і відео (перегляд вкладень)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
          'media-src': ["'self'", 'blob:'],
        },
      },
    }),
  );
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const requireAuth = makeRequireAuth(authService);
  const cookieOptions = {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.cookieSameSite,
    maxAge: config.jwtExpiresSeconds * 1000,
  };

  // Захист від підбору паролів: 20 спроб за 15 хвилин з одного IP
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    message: { error: 'Забагато спроб, спробуй пізніше' },
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authLimiter, authRoutes({ authService, requireAuth, cookieOptions }));
  app.get('/api/templates', requireAuth, (_req, res) => res.json({ templates: templateService.list() }));
  app.use('/api/maps', mapRoutes({ mapService, templateService, requireAuth }));
  app.use('/api/maps/:mapId/nodes', nodeRoutes({ nodeService, requireAuth }));

  app.use('/api/maps/:mapId/boundaries', boundaryRoutes({ boundaryService, requireAuth }));

  app.use('/api/maps/:mapId/links', linkRoutes({ linkService, requireAuth }));

  app.use('/api/maps/:mapId', attachmentRoutes({ attachmentService, requireAuth }));

  // Продакшен: ту саму адресу обслуговує і API, і зібраний клієнт (client/dist), тож cookie без ускладнень.
  // Файли з хешем у назві кешуються надовго, index.html ніколи; невідомі адреси без /api віддають index.html (SPA).
  if (clientDist && existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, {
      index: false,
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get(/^\/(?!api(\/|$)).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
