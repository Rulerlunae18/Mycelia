import { Router } from 'express';
import { createLinkSchema, parse, updateLinkSchema } from '../validation.js';

// Монтується на /api/maps/:mapId/links
export function linkRoutes({ linkService, requireAuth }) {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.post('/', async (req, res, next) => {
    try {
      const data = parse(createLinkSchema, req.body);
      res.status(201).json({ link: await linkService.create(req.userId, req.params.mapId, data) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const patch = parse(updateLinkSchema, req.body);
      const { mapId, id } = req.params;
      res.json({ link: await linkService.update(req.userId, mapId, id, patch) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const { mapId, id } = req.params;
      await linkService.remove(req.userId, mapId, id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
