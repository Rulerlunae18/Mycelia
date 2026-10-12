import { HttpError } from '../errors.js';

export function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, 'Маршрут не знайдено'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // Порушення унікальності в БД (гонка двох реєстрацій з одним email)
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Такий запис уже існує' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Файл або запит занадто великий' });
  }
  // Некоректний JSON у тілі запиту
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некоректний JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
}
