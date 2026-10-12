import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAuthStore } from './auth';

export const MAX_TABS = 12;

// Відкриті вкладки карт. Це зручність одного браузера, а не дані карти, тому живуть
// у localStorage (окремо для кожного користувача) і не потрапляють на сервер.
// Активна вкладка не зберігається тут: нею є карта з адреси /maps/:id.
export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref([]); // [{ id, title }]
  let loadedFor = null;

  const keyFor = (userId) => `mycelia.tabs.${userId}`;

  // Викликається перед використанням: підтягує збережені вкладки поточного користувача
  function ensureLoaded() {
    const userId = useAuthStore().user?.id ?? null;
    if (userId === loadedFor) return;
    loadedFor = userId;
    tabs.value = [];
    if (!userId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '[]');
      if (Array.isArray(saved)) {
        tabs.value = saved
          .filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string')
          .slice(0, MAX_TABS)
          .map(({ id, title }) => ({ id, title }));
      }
    } catch {
      /* пошкоджені або недоступні дані: починаємо з порожнього списку */
    }
  }

  watch(
    tabs,
    (value) => {
      if (!loadedFor) return;
      try {
        localStorage.setItem(keyFor(loadedFor), JSON.stringify(value));
      } catch {
        /* приватний режим або переповнене сховище: вкладки просто не переживуть перезавантаження */
      }
    },
    { deep: true },
  );

  // Відкриває вкладку (або оновлює заголовок наявної). Понад MAX_TABS закриваємо найстаріші.
  function open(id, title) {
    ensureLoaded();
    const existing = tabs.value.find((t) => t.id === id);
    if (existing) {
      existing.title = title;
      return;
    }
    tabs.value.push({ id, title });
    while (tabs.value.length > MAX_TABS) tabs.value.shift();
  }

  function setTitle(id, title) {
    const tab = tabs.value.find((t) => t.id === id);
    if (tab) tab.title = title;
  }

  // Закриває вкладку і повертає id, який варто показати замість неї:
  // сусід праворуч, інакше ліворуч, інакше null (тоді йдемо до списку карт)
  function close(id) {
    ensureLoaded();
    const i = tabs.value.findIndex((t) => t.id === id);
    if (i === -1) return null;
    tabs.value.splice(i, 1);
    return (tabs.value[i] ?? tabs.value[i - 1])?.id ?? null;
  }

  return { tabs, ensureLoaded, open, setTitle, close };
});
