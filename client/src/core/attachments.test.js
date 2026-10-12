import { describe, expect, it } from 'vitest';
import { checkFile, fileUrl, formatSize, MAX_ATTACHMENTS_PER_NODE, MAX_FILE_BYTES } from './attachments';

describe('вкладення на клієнті', () => {
  it('форматує розмір', () => {
    expect(formatSize(512)).toBe('512 Б');
    expect(formatSize(1536)).toBe('1.5 КБ');
    expect(formatSize(200 * 1024)).toBe('200 КБ');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 МБ');
  });

  it('перевіряє файл до завантаження', () => {
    expect(checkFile({ name: 'a.png', size: 100 }, 0)).toBeNull();
    expect(checkFile({ name: 'a.png', size: 0 }, 0)).toMatch(/порожній/);
    expect(checkFile({ name: 'big.mp4', size: MAX_FILE_BYTES + 1 }, 0)).toMatch(/більше/);
    expect(checkFile({ name: 'a.png', size: 1 }, MAX_ATTACHMENTS_PER_NODE)).toMatch(/Не більше/);
  });

  it('будує адресу файлу через apiUrl', () => {
    expect(fileUrl((p) => `/api${p}`, 'm1', 'a1')).toBe('/api/maps/m1/attachments/a1/file');
  });
});
