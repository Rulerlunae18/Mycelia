import { Router } from 'express';
import { createNodeSchema, moveNodeSchema, parse, updateNodeSchema } from '../validation.js';

// Монтується на /api/maps/:mapId/nodes
export function nodeRoutes({ nodeService, requireAuth }) {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.post('/', async (req, res, next) => {
    try {
      const data = parse(createNodeSchema, req.body);
      const node = await nodeService.create(req.userId, req.params.mapId, data);
      res.status(201).json({ node });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:nodeId', async (req, res, next) => {
    try {
      const patch = parse(updateNodeSchema, req.body);
      const { mapId, nodeId } = req.params;
      res.json({ node: await nodeService.update(req.userId, mapId, nodeId, patch) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:nodeId/move', async (req, res, next) => {
    try {
      const data = parse(moveNodeSchema, req.body);
      const { mapId, nodeId } = req.params;
      res.json({ changes: await nodeService.move(req.userId, mapId, nodeId, data) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:nodeId/duplicate', async (req, res, next) => {
    try {
      const { mapId, nodeId } = req.params;
      res.status(201).json(await nodeService.duplicate(req.userId, mapId, nodeId));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:nodeId', async (req, res, next) => {
    try {
      const { mapId, nodeId } = req.params;
      res.json(await nodeService.remove(req.userId, mapId, nodeId));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
