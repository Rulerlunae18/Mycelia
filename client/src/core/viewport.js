// Перетворення вигляду: екранна точка = світова * scale + (tx, ty).
// Чисті функції, щоб зум і панорамування можна було тестувати без браузера.

export const MIN_SCALE = 0.15;
export const MAX_SCALE = 3;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export const identity = () => ({ scale: 1, tx: 0, ty: 0 });

// Вписує всю карту у вікно по центру. Збільшувати понад 1.2x не будемо:
// маленька карта має лишатись маленькою, а не розпливатись на весь екран.
export function fitTransform(bounds, viewport, margin = 24) {
  const availableW = Math.max(1, viewport.width - margin * 2);
  const availableH = Math.max(1, viewport.height - margin * 2);
  const scale = clamp(
    Math.min(availableW / Math.max(1, bounds.width), availableH / Math.max(1, bounds.height)),
    MIN_SCALE,
    1.2,
  );
  return {
    scale,
    tx: (viewport.width - bounds.width * scale) / 2,
    ty: (viewport.height - bounds.height * scale) / 2,
  };
}

// Масштабування навколо екранної точки: вона лишається на місці під курсором.
export function zoomAt(t, point, factor) {
  const scale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
  const k = scale / t.scale;
  return { scale, tx: point.x - (point.x - t.tx) * k, ty: point.y - (point.y - t.ty) * k };
}

export const panBy = (t, dx, dy) => ({ ...t, tx: t.tx + dx, ty: t.ty + dy });
