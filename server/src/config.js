import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const isProd = process.env.NODE_ENV === 'production';

function required(name, fallbackForTests) {
  const value = process.env[name];
  if (value) return value;
  if (isTest && fallbackForTests !== undefined) return fallbackForTests;
  throw new Error(`Не задано змінну оточення ${name}. Дивись server/.env.example`);
}

export const config = {
  isTest,
  isProd,
  port: Number(process.env.PORT) || 3000,
  jwtSecret: required('JWT_SECRET', 'test-secret-test-secret-test-secret'),
  jwtExpiresSeconds: Number(process.env.JWT_EXPIRES_SECONDS) || 3600,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Куди зараз зберігаються вкладені файли (пізніше Supabase Storage)
  uploadDir: process.env.UPLOAD_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads'),
  // Якщо обидва задані, вкладення зберігаються в Supabase Storage замість папки на диску
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  supabaseBucket: process.env.SUPABASE_BUCKET || 'attachments',
  // Зібраний клієнт (client/dist): у продакшені його віддає сам сервер, тож API і сторінки на одному домені
  clientDist: process.env.CLIENT_DIST || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist'),
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
};
