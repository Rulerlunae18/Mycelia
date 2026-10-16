import { LocalDiskStorage } from './LocalDiskStorage.js';
import { SupabaseStorage } from './SupabaseStorage.js';

// Вибір реалізації «сховища файлів» за налаштуваннями: якщо задано Supabase, файли йдуть туди
// (продакшен на Render), інакше лежать у папці на диску (розробка).
export function createStorage(config) {
  if (config.supabaseUrl && config.supabaseServiceKey) {
    return new SupabaseStorage({
      url: config.supabaseUrl,
      serviceKey: config.supabaseServiceKey,
      bucket: config.supabaseBucket,
    });
  }
  return new LocalDiskStorage(config.uploadDir);
}
