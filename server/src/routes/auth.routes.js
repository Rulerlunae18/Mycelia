import { Router } from 'express';
import { TOKEN_COOKIE } from '../middleware/auth.js';
import { credentialsSchema, parse } from '../validation.js';

export function authRoutes({ authService, requireAuth, cookieOptions }) {
  const router = Router();

  const startSession = (res, user) => {
    res.cookie(TOKEN_COOKIE, authService.issueToken(user), cookieOptions);
  };

  router.post('/register', async (req, res, next) => {
    try {
      const credentials = parse(credentialsSchema, req.body);
      const user = await authService.register(credentials);
      startSession(res, user);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const credentials = parse(credentialsSchema, req.body);
      const user = await authService.login(credentials);
      startSession(res, user);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(TOKEN_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      res.json({ user: await authService.getUser(req.userId) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
