import { z } from 'zod';
import { badRequest } from './errors.js';

// bcrypt обробляє лише перші 72 байти пароля, тому верхня межа 72.
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некоректний email').max(254),
  password: z
    .string()
    .min(8, 'Пароль має містити щонайменше 8 символів')
    .max(72, 'Пароль занадто довгий (максимум 72 символи)'),
});

export const LAYOUTS = ['radial', 'tree', 'bilateral'];

export const createMapSchema = z.object({
  title: z.string().trim().min(1, 'Назва не може бути порожньою').max(120),
  theme: z.string().trim().max(32).optional(),
  layout: z.enum(LAYOUTS).optional(),
});

export const updateMapSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    theme: z.string().trim().max(32).optional(),
    layout: z.enum(LAYOUTS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Немає полів для оновлення');

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    throw badRequest(issues[0]?.message || 'Некоректні дані', issues);
  }
  return result.data;
}
