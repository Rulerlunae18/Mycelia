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
// Назви тем збігаються з THEME_NAMES клієнта (client/src/core/theme)
export const THEMES = ['forest', 'paper', 'ocean'];

export const createMapSchema = z.object({
  title: z.string().trim().min(1, 'Назва не може бути порожньою').max(120),
  theme: z.enum(THEMES).optional(),
  layout: z.enum(LAYOUTS).optional(),
});

export const updateMapSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    theme: z.enum(THEMES).optional(),
    layout: z.enum(LAYOUTS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Немає полів для оновлення');

// ---- Вузли ----

// Ключі значків категорій збігаються з CATEGORIES клієнта (client/src/core/marks.js)
export const CATEGORIES = ['idea', 'task', 'question', 'info', 'risk', 'decision'];
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const nodeText = z.string().max(2000, 'Текст вузла занадто довгий (максимум 2000 символів)');
const styleSchema = z
  .record(z.string().max(32), z.union([z.string().max(64), z.number(), z.boolean()]))
  .refine((v) => Object.keys(v).length <= 20, 'Забагато полів стилю');

export const createNodeSchema = z.object({
  parentId: z.string().min(1).max(64),
  text: nodeText.default(''),
  index: z.number().int().min(0).optional(),
});

export const updateNodeSchema = z
  .object({
    text: nodeText.optional(),
    collapsed: z.boolean().optional(),
    style: styleSchema.optional(),
    category: z.enum(CATEGORIES).nullable().optional(),
    priority: z.enum(PRIORITIES).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Немає полів для оновлення');

export const moveNodeSchema = z.object({
  parentId: z.string().min(1).max(64),
  index: z.number().int().min(0).optional(),
});

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

// ---- Області (пунктирні контури навколо групи вузлів) ----

const boundaryLabel = z.string().trim().max(120, 'Назва області занадто довга (максимум 120 символів)');
const boundaryNodeIds = z.array(z.string().min(1)).min(1, 'Область має містити хоча б один вузол').max(2000);

export const createBoundarySchema = z.object({
  label: boundaryLabel.default(''),
  nodeIds: boundaryNodeIds,
});

export const updateBoundarySchema = z
  .object({ label: boundaryLabel.optional(), nodeIds: boundaryNodeIds.optional() })
  .refine((v) => Object.keys(v).length > 0, 'Немає полів для оновлення');
