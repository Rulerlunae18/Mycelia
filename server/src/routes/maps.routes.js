import { Router } from 'express';
import { createMapSchema, parse, updateMapSchema } from '../validation.js';

export function mapRoutes({ mapService, requireAuth }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      res.json({ maps: await mapService.list(req.userId) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const data = parse(createMapSchema, req.body);
      res.status(201).json({ map: await mapService.create(req.userId, data) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      res.json({ map: await mapService.get(req.userId, req.params.id) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const patch = parse(updateMapSchema, req.body);
      res.json({ map: await mapService.update(req.userId, req.params.id, patch) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await mapService.remove(req.userId, req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
