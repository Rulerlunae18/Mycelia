import { describe, expect, it } from 'vitest';
import { SupabaseStorage } from '../src/storage/SupabaseStorage.js';
import { createStorage } from '../src/storage/index.js';
import { LocalDiskStorage } from '../src/storage/LocalDiskStorage.js';

// Фейковий Supabase: тримає файли в пам'яті і відповідає так само, як REST API сховища
function fakeSupabase() {
  const files = new Map();
  const calls = [];
  const fetchImpl = async (url, { method = 'GET', headers = {}, body } = {}) => {
    calls.push({ url, method, headers });
    const m = /\/storage\/v1\/object\/(?:authenticated\/)?([\w-]+)\/(.+)$/.exec(url);
    const key = `${m[1]}/${m[2]}`;
    if (method === 'POST') { files.set(key, Buffer.from(body)); return new Response(null, { status: 200 }); }
    if (method === 'DELETE') { files.delete(key); return new Response(null, { status: files.has(key) ? 500 : 200 }); }
    const file = files.get(key);
    if (!file) return new Response('{"error":"not_found"}', { status: 404 });
    if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(file.length) } });
    const range = /bytes=(\d+)-(\d*)/.exec(headers.Range ?? '');
    if (range) {
      const end = range[2] === '' ? file.length - 1 : Number(range[2]);
      return new Response(file.subarray(Number(range[1]), end + 1), { status: 206 });
    }
    return new Response(file, { status: 200 });
  };
  return { fetchImpl, files, calls };
}

const drain = async (stream) => {
  const parts = [];
  for await (const chunk of stream) parts.push(chunk);
  return Buffer.concat(parts);
};

describe('SupabaseStorage (Strategy)', () => {
  const make = () => {
    const fake = fakeSupabase();
    const storage = new SupabaseStorage({ url: 'https://x.supabase.co/', serviceKey: 'secret', bucket: 'files', fetchImpl: fake.fetchImpl });
    return { storage, ...fake };
  };

  it('зберігає, повертає розмір, читає і видаляє файл; ключ сервісу йде лише в заголовках', async () => {
    const { storage, files, calls } = make();
    await storage.put('map1/file1', Buffer.from('привіт, світе'));
    expect(files.has('files/map1/file1')).toBe(true);
    expect(calls[0].url).toBe('https://x.supabase.co/storage/v1/object/files/map1/file1');
    expect(calls[0].headers).toMatchObject({ Authorization: 'Bearer secret', apikey: 'secret', 'x-upsert': 'true' });
    expect(calls.every((c) => !c.url.includes('secret'))).toBe(true);

    expect(await storage.size('map1/file1')).toBe(Buffer.byteLength('привіт, світе'));
    expect((await drain(storage.read('map1/file1'))).toString()).toBe('привіт, світе');

    await storage.remove('map1/file1');
    expect(files.size).toBe(0);
    expect(await storage.size('map1/file1')).toBeNull();
    await expect(storage.remove('map1/file1')).resolves.toBeUndefined(); // відсутній файл не помилка
  });

  it('читає діапазон байтів (для відео) включно з кінцем', async () => {
    const { storage } = make();
    await storage.put('m/f', Buffer.from('0123456789'));
    expect((await drain(storage.read('m/f', { start: 2, end: 5 }))).toString()).toBe('2345');
    expect((await drain(storage.read('m/f', { start: 7 }))).toString()).toBe('789');
  });

  it('помилка сховища робить потік помилковим, а не зависає', async () => {
    const { storage } = make();
    await expect(drain(storage.read('m/missing'))).rejects.toThrow(/не вдалося прочитати/);
    const broken = new SupabaseStorage({ url: 'https://x', serviceKey: 'k', fetchImpl: async () => new Response('boom', { status: 500 }) });
    await expect(broken.put('m/f', Buffer.from('x'))).rejects.toThrow(/не вдалося зберегти файл \(500\)/);
  });

  it('не приймає ключ зі шляхом назовні і не працює без налаштувань', async () => {
    const { storage } = make();
    await expect(storage.put('../etc/passwd', Buffer.from('x'))).rejects.toThrow('Некоректний ключ');
    expect(() => storage.read('a/../b')).toThrow('Некоректний ключ');
    expect(() => new SupabaseStorage({ url: '', serviceKey: '' })).toThrow(/SUPABASE_URL/);
  });
});

describe('createStorage', () => {
  it('Supabase, якщо задано URL і ключ, інакше папка на диску', () => {
    expect(createStorage({ supabaseUrl: 'https://x.supabase.co', supabaseServiceKey: 'k', supabaseBucket: 'b', uploadDir: '/tmp/u' })).toBeInstanceOf(SupabaseStorage);
    expect(createStorage({ supabaseUrl: 'https://x.supabase.co', supabaseServiceKey: '', uploadDir: '/tmp/u' })).toBeInstanceOf(LocalDiskStorage);
    expect(createStorage({ supabaseUrl: '', supabaseServiceKey: '', uploadDir: '/tmp/u' })).toBeInstanceOf(LocalDiskStorage);
  });
});
