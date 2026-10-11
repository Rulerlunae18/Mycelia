import 'dotenv/config';

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
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
};
