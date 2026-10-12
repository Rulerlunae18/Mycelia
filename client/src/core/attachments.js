// Правила вкладень на клієнті. Збігаються з server/src/domain/files.js:
// клієнт перевіряє раніше, щоб не вантажити зайве, а остаточне слово за сервером.
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_NODE = 10;

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

// Повертає текст помилки або null, якщо файл можна вантажити
export function checkFile(file, existingCount) {
  if (!file.size) return `«${file.name}»: файл порожній`;
  if (file.size > MAX_FILE_BYTES) return `«${file.name}»: більше ${formatSize(MAX_FILE_BYTES)}`;
  if (existingCount >= MAX_ATTACHMENTS_PER_NODE) return `Не більше ${MAX_ATTACHMENTS_PER_NODE} вкладень на вузлі`;
  return null;
}

export const fileUrl = (apiUrl, mapId, attachmentId) => apiUrl(`/maps/${mapId}/attachments/${attachmentId}/file`);
