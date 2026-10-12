import { Router } from 'express';
import { createBoundarySchema, parse, updateBoundarySchema } from '../validation.js';

// Монтується на /api/maps/:mapId/boundaries
export function boundaryRoutes({ boundaryService, requireAuth }) {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.post('/', async (req, res, next) => {
    try {
      const data = parse(createBoundarySchema, req.body);
      res.status(201).json({ boundary: await boundaryService.create(req.userId, req.params.mapId, data) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const patch = parse(updateBoundarySchema, req.body);
      const { mapId, id } = req.params;
      res.json({ boundary: await boundaryService.update(req.userId, mapId, id, patch) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const { mapId, id } = req.params;
      await boundaryService.remove(req.userId, mapId, id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
