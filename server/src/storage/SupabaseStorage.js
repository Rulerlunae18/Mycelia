import { PassThrough, Readable } from 'node:stream';

// Патерн Strategy: ще одна реалізація «сховища файлів» (поруч із LocalDiskStorage), той самий інтерфейс:
//   put(key, buffer) · size(key) · read(key, { start, end }) · remove(key)
// Працює через REST API Supabase Storage, без додаткових залежностей: на Render диск тимчасовий,
// тож вкладення мусять жити в зовнішньому сховищі. Бакет приватний, файли віддає наш API
// після перевірки власника карти, а сервісний ключ ніколи не потрапляє в браузер.
const KEY = /^[\w-]+\/[\w-]+$/;

export class SupabaseStorage {
  constructor({ url, serviceKey, bucket = 'attachments', fetchImpl = globalThis.fetch }) {
    if (!url || !serviceKey) throw new Error('Для Supabase Storage потрібні SUPABASE_URL і SUPABASE_SERVICE_KEY');
    this.base = `${url.replace(/\/+$/, '')}/storage/v1/object`;
    this.bucket = bucket;
    this.fetch = fetchImpl;
    this.headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  }

  #key(key) {
    if (!KEY.test(key)) throw new Error('Некоректний ключ сховища');
    return key;
  }

  async #fail(res, action) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase Storage: не вдалося ${action} (${res.status}) ${detail.slice(0, 200)}`);
  }

  async put(key, buffer) {
    const res = await this.fetch(`${this.base}/${this.bucket}/${this.#key(key)}`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
      body: buffer,
    });
    if (!res.ok) await this.#fail(res, 'зберегти файл');
  }

  async size(key) {
    const res = await this.fetch(`${this.base}/authenticated/${this.bucket}/${this.#key(key)}`, {
      method: 'HEAD',
      headers: this.headers,
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) await this.#fail(res, 'дізнатись розмір файлу');
    const length = Number(res.headers.get('content-length'));
    return Number.isFinite(length) ? length : null;
  }

  // Потік потрібен одразу (як createReadStream), а відповідь приходить пізніше: віддаємо PassThrough
  read(key, { start, end } = {}) {
    const out = new PassThrough();
    const headers = { ...this.headers };
    if (start !== undefined) headers.Range = `bytes=${start}-${end ?? ''}`;
    this.fetch(`${this.base}/authenticated/${this.bucket}/${this.#key(key)}`, { headers })
      .then((res) => {
        if (!res.ok || !res.body) throw new Error(`Supabase Storage: не вдалося прочитати файл (${res.status})`);
        Readable.fromWeb(res.body).on('error', (err) => out.destroy(err)).pipe(out);
      })
      .catch((err) => out.destroy(err));
    return out;
  }

  async remove(key) {
    const res = await this.fetch(`${this.base}/${this.bucket}/${this.#key(key)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok && res.status !== 404 && res.status !== 400) await this.#fail(res, 'видалити файл');
  }
}
