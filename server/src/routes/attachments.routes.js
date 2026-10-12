import express, { Router } from 'express';
import { MAX_FILE_BYTES, parseRange, sanitizeName } from '../domain/files.js';
import { badRequest } from '../errors.js';

// Монтується на /api/maps/:mapId
//   POST   /nodes/:nodeId/attachments?name=&mime=   тіло запиту: сирі байти файлу
//   GET    /attachments/:id/file                    сам файл (підтримує Range для відео)
//   DELETE /attachments/:id
//
// Файл іде сирим тілом (application/octet-stream), а не multipart: так не потрібна
// зайва залежність, а ім'я і тип передаються в параметрах.
export function attachmentRoutes({ attachmentService, requireAuth }) {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  const rawFile = express.raw({ type: () => true, limit: MAX_FILE_BYTES });

  router.post('/nodes/:nodeId/attachments', rawFile, async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body)) throw badRequest('Файл не передано');
      const { mapId, nodeId } = req.params;
      const attachment = await attachmentService.add(req.userId, mapId, nodeId, {
        name: req.query.name,
        mime: req.query.mime,
        buffer: req.body,
      });
      res.status(201).json({ attachment });
    } catch (err) {
      next(err);
    }
  });

  router.get('/attachments/:id/file', async (req, res, next) => {
    try {
      const { meta, size, read } = await attachmentService.open(req.userId, req.params.mapId, req.params.id);
      const inline = meta.kind !== 'file'; // картинки й відео показуємо, решту лише завантажуємо
      const range = req.headers.range ? parseRange(req.headers.range, size) : null;
      if (req.headers.range && !range) {
        res.status(416).set('Content-Range', `bytes */${size}`).end();
        return;
      }

      res.set({
        'Content-Type': meta.mime,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(sanitizeName(meta.name))}`,
        // Файл користувача не має виконувати нічого в нашому домені
        'Content-Security-Policy': "default-src 'none'; sandbox",
        // Клієнт на іншому домені (продакшен) має право показати картинку; доступ усе одно лише з cookie
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'private, max-age=3600',
      });

      if (range) {
        res.status(206).set({
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
          'Content-Length': String(range.end - range.start + 1),
        });
      } else {
        res.set('Content-Length', String(size));
      }
      const stream = read(range ?? undefined);
      stream.on('error', next);
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/attachments/:id', async (req, res, next) => {
    try {
      await attachmentService.remove(req.userId, req.params.mapId, req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
