import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useAuthStore } from './auth';
import { MAX_TABS, useTabsStore } from './tabs';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    data,
  };
}

function setup(userId = 'u1', storage = fakeStorage()) {
  vi.stubGlobal('localStorage', storage);
  setActivePinia(createPinia());
  useAuthStore().user = userId ? { id: userId } : null;
  return { tabs: useTabsStore(), storage };
}

describe('вкладки карт', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('відкриває вкладку один раз, а повторне відкриття лише оновлює назву', () => {
    const { tabs } = setup();
    tabs.open('a', 'Перша');
    tabs.open('b', 'Друга');
    tabs.open('a', 'Перша (нова назва)');
    expect(tabs.tabs).toEqual([{ id: 'a', title: 'Перша (нова назва)' }, { id: 'b', title: 'Друга' }]);
  });

  it('закриття повертає сусіда праворуч, інакше ліворуч, інакше null', () => {
    const { tabs } = setup();
    ['a', 'b', 'c'].forEach((id) => tabs.open(id, id));
    expect(tabs.close('b')).toBe('c');
    expect(tabs.close('c')).toBe('a');
    expect(tabs.close('a')).toBeNull();
    expect(tabs.close('немає')).toBeNull();
  });

  it(`тримає не більше ${MAX_TABS} вкладок: найстарішу закриває`, () => {
    const { tabs } = setup();
    for (let i = 0; i < MAX_TABS + 3; i++) tabs.open(`m${i}`, `Карта ${i}`);
    expect(tabs.tabs).toHaveLength(MAX_TABS);
    expect(tabs.tabs[0].id).toBe('m3');
    expect(tabs.tabs.at(-1).id).toBe(`m${MAX_TABS + 2}`);
  });

  it('зберігає вкладки в localStorage окремо для кожного користувача і відновлює їх', async () => {
    const first = setup('u1');
    first.tabs.open('a', 'Перша');
    await nextTick();
    expect(JSON.parse(first.storage.data.get('mycelia.tabs.u1'))).toEqual([{ id: 'a', title: 'Перша' }]);

    // нова «сесія» того ж користувача бачить ті самі вкладки
    const again = setup('u1', first.storage);
    again.tabs.ensureLoaded();
    expect(again.tabs.tabs).toEqual([{ id: 'a', title: 'Перша' }]);

    // інший користувач у тому ж браузері не бачить чужих вкладок
    const other = setup('u2', first.storage);
    other.tabs.ensureLoaded();
    expect(other.tabs.tabs).toEqual([]);
  });

  it('пошкоджені збережені дані не ламають застосунок', () => {
    const { tabs } = setup('u1', fakeStorage({ 'mycelia.tabs.u1': '{не json' }));
    tabs.ensureLoaded();
    expect(tabs.tabs).toEqual([]);
    const { tabs: odd } = setup('u1', fakeStorage({ 'mycelia.tabs.u1': JSON.stringify([{ id: 1 }, null, { id: 'ok', title: 'Так' }]) }));
    odd.ensureLoaded();
    expect(odd.tabs).toEqual([{ id: 'ok', title: 'Так' }]);
  });

  it('недоступне сховище (приватний режим) не кидає помилок', async () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    const { tabs } = setup('u1', broken);
    expect(() => tabs.open('a', 'Перша')).not.toThrow();
    await nextTick();
    expect(tabs.tabs).toHaveLength(1);
  });
});
