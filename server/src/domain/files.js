// Правила для вкладених файлів: безпечне ім'я і визначення типу за вмістом.
// Заявленому браузером типу не вірить: файл вважається картинкою чи відео лише
// якщо його перші байти справді відповідають заявленому формату. Усе інше стає
// звичайним файлом, який віддається лише для завантаження (не виконується в браузері).

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_NODE = 10;
export const MAX_ATTACHMENTS_PER_MAP = 100;

const starts = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

const SIGNATURES = {
  'image/png': (b) => starts(b, [0x89, 0x50, 0x4e, 0x47]),
  'image/jpeg': (b) => starts(b, [0xff, 0xd8, 0xff]),
  'image/gif': (b) => starts(b, ascii('GIF8')),
  'image/webp': (b) => starts(b, ascii('RIFF')) && starts(b, ascii('WEBP'), 8),
  'video/mp4': (b) => starts(b, ascii('ftyp'), 4),
  'video/webm': (b) => starts(b, [0x1a, 0x45, 0xdf, 0xa3]),
};

// SVG і HTML навмисно не серед картинок: у них може бути скрипт
export function classify(declaredMime, buffer) {
  const mime = String(declaredMime ?? '').toLowerCase().split(';')[0].trim();
  const matches = SIGNATURES[mime];
  if (matches && matches(buffer)) return { kind: mime.startsWith('image/') ? 'image' : 'video', mime };
  return { kind: 'file', mime: 'application/octet-stream' };
}

// Лишає тільки ім'я без шляху й керівних символів, не довше 120 символів
export function sanitizeName(raw) {
  const base = String(raw ?? '').split(/[\\/]/).pop();
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|?*:]/g, '').trim().slice(0, 120);
  return clean && clean !== '.' && clean !== '..' ? clean : 'файл';
}

// Діапазон із заголовка Range: "bytes=0-99", "bytes=100-", "bytes=-50". null якщо некоректний.
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}
