// VITE_API_URL задається лише коли API на іншому домені (продакшен на Render).
// У розробці працює проксі Vite, тому шлях відносний.
const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function handle(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Помилка запиту', data.details);
  return data;
}

async function request(method, path, body) {
  return handle(
    await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include', // httpOnly-cookie з JWT
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

// Файл іде сирим тілом, ім'я і тип у параметрах (див. server/src/routes/attachments.routes.js)
async function upload(path, file) {
  const query = new URLSearchParams({ name: file.name, mime: file.type || '' });
  return handle(
    await fetch(`${BASE}${path}?${query}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    }),
  );
}

// Повна адреса ресурсу API (для <img src> і <video src>, де fetch недоступний)
export const apiUrl = (path) => `${BASE}${path}`;

export const http = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  upload,
};
