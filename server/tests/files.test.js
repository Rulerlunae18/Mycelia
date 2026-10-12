import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classify, parseRange, sanitizeName } from '../src/domain/files.js';
import { LocalDiskStorage } from '../src/storage/LocalDiskStorage.js';

describe('domain/files', () => {
  it('parseRange розуміє три форми і відкидає некоректні', () => {
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=0-999', 100)).toEqual({ start: 0, end: 99 });
    for (const bad of ['bytes=100-', 'bytes=5-2', 'bytes=-', 'items=0-1', 'bytes=a-b', undefined]) {
      expect(parseRange(bad, 100), String(bad)).toBeNull();
    }
  });

  it('classify: webp і gif впізнаються за сигнатурою, збіг лише разом із заявленим типом', () => {
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
    expect(classify('image/webp', webp).kind).toBe('image');
    expect(classify('image/png', webp).kind).toBe('file');
    expect(classify('image/gif', Buffer.from('GIF89a..')).kind).toBe('image');
    expect(classify(undefined, Buffer.from('GIF89a..')).kind).toBe('file');
    expect(classify('IMAGE/GIF; charset=x', Buffer.from('GIF89a..')).kind).toBe('image');
  });

  it('sanitizeName', () => {
    expect(sanitizeName('C:\\docs\\звіт.docx')).toBe('звіт.docx');
    expect(sanitizeName('a'.repeat(300))).toHaveLength(120);
    expect(sanitizeName(undefined)).toBe('файл');
  });
});

describe('LocalDiskStorage', () => {
  let dir, storage;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mycelia-'));
    storage = new LocalDiskStorage(dir);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('зберігає, читає (в тому числі діапазон), міряє і видаляє', async () => {
    await storage.put('map1/file1', Buffer.from('0123456789'));
    expect(await storage.size('map1/file1')).toBe(10);
    const chunks = [];
    for await (const c of storage.read('map1/file1', { start: 2, end: 4 })) chunks.push(c);
    expect(Buffer.concat(chunks).toString()).toBe('234');
    await storage.remove('map1/file1');
    expect(await storage.size('map1/file1')).toBeNull();
    await storage.remove('map1/file1'); // повторне видалення не помилка
  });

  it('не дає вийти за межі кореневої папки', async () => {
    for (const key of ['../evil', 'a/../../evil', '/etc/passwd', 'a/b/c', 'a\\b', '']) {
      await expect(storage.put(key, Buffer.from('x')), key).rejects.toThrow();
    }
    await expect(readFile(path.join(dir, '..', 'evil'))).rejects.toThrow();
  });
});
