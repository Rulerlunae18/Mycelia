import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Патерн Strategy: «сховище файлів». AttachmentService знає лише цей інтерфейс
//   put(key, buffer)            зберегти
//   size(key)                   розмір у байтах (або null, якщо немає)
//   read(key, { start, end })   потік для читання (діапазон включно, необов'язково)
//   remove(key)                 видалити (відсутній файл не помилка)
// Зараз файли лежать на диску; Supabase Storage стане ще однією реалізацією того самого
// інтерфейсу без змін у сервісі.
//
// Ключ має вигляд «mapId/fileId»: ім'я файлу від користувача в шлях не потрапляє,
// а формат ключа перевіряється, тому вийти за межі кореневої папки неможливо.
const KEY = /^[\w-]+\/[\w-]+$/;

export class LocalDiskStorage {
  constructor(rootDir) {
    this.root = path.resolve(rootDir);
  }

  #path(key) {
    if (!KEY.test(key)) throw new Error('Некоректний ключ сховища');
    const full = path.join(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Некоректний ключ сховища');
    return full;
  }

  async put(key, buffer) {
    const file = this.#path(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buffer);
  }

  async size(key) {
    try {
      return (await stat(this.#path(key))).size;
    } catch {
      return null;
    }
  }

  read(key, range = {}) {
    return createReadStream(this.#path(key), range);
  }

  async remove(key) {
    await rm(this.#path(key), { force: true });
  }
}
