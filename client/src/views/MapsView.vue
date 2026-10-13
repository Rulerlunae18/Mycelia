<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../api/http';
import { useTabsStore } from '../stores/tabs';
import MyceliumBackdrop from '../components/MyceliumBackdrop.vue';
 
const router = useRouter();
const tabs = useTabsStore();
const maps = ref([]);
const title = ref('');
const loading = ref(true);
const templates = ref([]); // зразки з сервера для нової карти
const template = ref('');
const error = ref('');
const titleInput = ref(null);
const confirmingId = ref(null); // карта, для якої показано підтвердження видалення
 
// фокус одразу на «Скасувати» — безпечніше за випадковий Enter
const vFocus = { mounted: (el) => el.focus() };
 
// опис вибраного шаблону показуємо під формою
const selectedTemplate = computed(() => templates.value.find((t) => t.key === template.value));
 
async function load() {
  try {
    [maps.value, templates.value] = [(await http.get('/maps')).maps, (await http.get('/templates')).templates];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
 
async function create() {
  if (!title.value.trim()) return;
  error.value = '';
  try {
    const { map } = await http.post('/maps', { title: title.value, ...(template.value && { template: template.value }) });
    router.push({ name: 'editor', params: { id: map.id } });
  } catch (err) {
    error.value = err.message;
  }
}
 
const askRemove = (map) => (confirmingId.value = map.id);
const cancelRemove = () => (confirmingId.value = null);
 
async function remove(map) {
  try {
    await http.delete(`/maps/${map.id}`);
    maps.value = maps.value.filter((m) => m.id !== map.id);
    tabs.close(map.id);
  } catch (err) {
    error.value = err.message;
  } finally {
    confirmingId.value = null;
  }
}
 
const focusTitle = () => titleInput.value?.focus();
 
// «1 карта», «2 карти», «5 карт»
function mapsCount(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} карта`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} карти`;
  return `${n} карт`;
}
 
// «сьогодні», «вчора» або «12 жовтня»
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function when(value) {
  const date = new Date(value);
  const now = new Date();
  const diff = Math.round((dayStart(now) - dayStart(date)) / 86400000);
  if (diff === 0) return 'сьогодні';
  if (diff === 1) return 'вчора';
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
}
const full = (d) => new Date(d).toLocaleString('uk-UA');
 
// ── «Відбиток спори»: унікальна гілчаста піктограма для кожної карти ──
// Малюнок залежить тільки від id, тому не змінюється при перейменуванні.
function hashString(str) {
  let h = 2166136261;
  for (const ch of str) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const fix = (n) => n.toFixed(1);
 
const prints = new Map();
function sporePrint(id) {
  const key = String(id);
  if (prints.has(key)) return prints.get(key);
 
  const rand = seeded(hashString(key));
  const nodes = [{ x: 28, y: 30, a: rand() * Math.PI * 2, r: 2.6 }];
  const segments = [];
  const count = 6 + Math.floor(rand() * 4);
 
  for (let i = 0; i < count; i++) {
    const parent = nodes[Math.floor(rand() * nodes.length)];
    const angle = parent.a + (rand() - 0.5) * 2.2;
    const len = 9 + rand() * 7;
    const x = clamp(parent.x + Math.cos(angle) * len, 6, 50);
    const y = clamp(parent.y + Math.sin(angle) * len, 6, 50);
    const bend = (rand() - 0.5) * 8;
    const cx = (parent.x + x) / 2 - Math.sin(angle) * bend;
    const cy = (parent.y + y) / 2 + Math.cos(angle) * bend;
    segments.push(`M${fix(parent.x)} ${fix(parent.y)}Q${fix(cx)} ${fix(cy)} ${fix(x)} ${fix(y)}`);
    nodes.push({ x, y, a: angle, r: 1.2 + rand() });
  }
 
  const result = { d: segments.join(''), dots: nodes };
  prints.set(key, result);
  return result;
}
 
onMounted(load);
</script>
 
<template>
  <MyceliumBackdrop />
  <div class="maps-container">
    <header class="head">
      <h1 class="page-title">Мої карти</h1>
      <p v-if="!loading && maps.length" class="count">{{ mapsCount(maps.length) }}</p>
    </header>
 
    <form class="create" @submit.prevent="create">
      <div class="name-field">
        <input
          ref="titleInput"
          v-model="title"
          type="text"
          placeholder="Назва нової карти"
          maxlength="120"
          aria-label="Назва нової карти"
          class="styled-input"
        />
        <i class="hypha" aria-hidden="true" />
      </div>
      <select v-model="template" aria-label="Шаблон" class="styled-input">
        <option value="">Порожня карта</option>
        <option v-for="t in templates" :key="t.key" :value="t.key" :title="t.description">{{ t.title }}</option>
      </select>
      <button class="submit" :disabled="!title.trim()">Створити</button>
      <p v-if="selectedTemplate?.description" class="hint">{{ selectedTemplate.description }}</p>
    </form>
 
    <p v-if="error" class="error" role="alert">{{ error }}</p>
 
    <ul v-if="loading" class="list" aria-busy="true" aria-label="Завантаження карт">
      <li v-for="n in 3" :key="n" class="skeleton" />
    </ul>
 
    <div v-else-if="!maps.length" class="empty">
      <svg class="seed" viewBox="0 0 120 64" aria-hidden="true">
        <path
          d="M60 52C60 40 52 34 40 30M60 52C60 38 66 30 80 24M60 52C58 42 60 30 58 16M40 30C34 28 28 22 22 20M80 24C88 22 94 16 100 10M58 16C54 12 50 9 47 6"
        />
        <circle class="tip" cx="22" cy="20" r="1.6" />
        <circle class="tip" cx="100" cy="10" r="1.6" />
        <circle class="tip" cx="47" cy="6" r="1.6" />
        <circle class="root" cx="60" cy="52" r="3.4" />
      </svg>
      <p>Тут ще порожньо. Назви першу карту, і від неї виросте решта.</p>
      <button type="button" class="empty-cta" @click="focusTitle">Назвати першу карту</button>
    </div>
 
    <ul v-else class="list">
      <li
        v-for="(m, index) in maps"
        :key="m.id"
        class="item"
        :class="{ 'is-confirming': confirmingId === m.id }"
        :style="{ animationDelay: `${Math.min(index, 6) * 0.07}s` }"
        @keydown.esc="cancelRemove"
      >
        <svg class="print" viewBox="0 0 56 56" aria-hidden="true">
          <path :d="sporePrint(m.id).d" pathLength="1" />
          <circle v-for="(dot, i) in sporePrint(m.id).dots" :key="i" :cx="dot.x" :cy="dot.y" :r="dot.r" />
        </svg>
 
        <div class="body">
          <RouterLink :to="{ name: 'editor', params: { id: m.id } }" class="name">{{ m.title }}</RouterLink>
          <time class="when" :datetime="m.updatedAt" :title="full(m.updatedAt)">оновлено {{ when(m.updatedAt) }}</time>
        </div>
 
        <div v-if="confirmingId === m.id" class="confirm" role="group" :aria-label="`Видалити карту «${m.title}»?`">
          <span class="confirm-text">Видалити?</span>
          <button v-focus type="button" class="btn btn-ghost" @click="cancelRemove">Скасувати</button>
          <button type="button" class="btn btn-danger" @click="remove(m)">Видалити</button>
        </div>
        <button
          v-else
          type="button"
          class="remove"
          :aria-label="`Видалити карту «${m.title}»`"
          title="Видалити"
          @click="askRemove(m)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>
 
<style scoped>
.maps-container {
  --ink: #e4f7ea;
  --soft: #b4cfbf;
  --glow: #7ee0a4;
  --line: rgba(126, 224, 164, 0.22);
  --danger: #ff8a78;
  --pad: 38px; /* відступ списку: тут проходить «нитка» */
  --curve: 16px; /* радіус гілочки від нитки до картки */
 
  position: relative; z-index: 1; max-width: 860px; margin: 0 auto; padding: 6px 20px 90px;
}

.maps-container::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1; /* над мицелієм, під вмістом */
  pointer-events: none;
  background: radial-gradient(
    ellipse 55% 75% at 50% 45%,
    rgba(15, 23, 19, 0.8) 0%,
    rgba(15, 23, 19, 0.5) 55%,
    rgba(15, 23, 19, 0) 100%
  );
}
 
/* ── Заголовок: Cormorant, як слоган і «Вхід» на екрані входу ── */
.head {
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between;
  gap: 4px 20px; margin-bottom: 30px;
  animation: fade-in 0.9s ease both;
}
.page-title {
  margin: 0; font-family: Cormorant, Georgia, serif; font-weight: 600;
  font-size: clamp(2.7rem, 6vw, 3.9rem); line-height: 1; letter-spacing: -0.005em; color: var(--ink);
  text-shadow: 0 0 28px rgba(126, 224, 164, 0.22);
}
.count {
  margin: 0; font-family: Cormorant, Georgia, serif; font-style: italic; font-weight: 500;
  font-size: 1.4rem; color: var(--soft);
}
 
/* ── Форма створення ── */
.create {
  display: flex; flex-wrap: wrap; align-items: stretch; gap: 14px;
  margin-bottom: 44px; padding: 20px;
  background: rgba(20, 32, 26, 0.78); backdrop-filter: blur(12px);
  border: 1px solid var(--line); border-radius: 18px;
  box-shadow: 0 0 0 1px rgba(126, 224, 164, 0.05), 0 24px 60px rgba(0, 0, 0, 0.45);
  animation: fade-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s both;
}
.name-field { position: relative; flex: 1 1 260px; }
 
.styled-input {
  width: 100%; box-sizing: border-box; padding: 13px 16px; font: inherit; font-size: 1rem; color: var(--ink);
  background: rgba(8, 16, 12, 0.55); border: 1px solid var(--line); border-radius: 11px;
  outline: none; transition: background 0.25s, border-color 0.25s;
}
.styled-input::placeholder { color: rgba(180, 207, 191, 0.5); }
.styled-input:focus { background: rgba(8, 16, 12, 0.8); border-color: rgba(126, 224, 164, 0.55); }
 
/* Гіфа: нитка проростає під полем при фокусі, зліва направо */
.hypha {
  position: absolute; left: 11px; right: 11px; bottom: 0; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, rgba(126, 224, 164, 0), var(--glow) 40%, #d2ffe6);
  box-shadow: 0 0 10px rgba(126, 224, 164, 0.7);
  transform: scaleX(0); transform-origin: left; opacity: 0; pointer-events: none;
  transition: transform 0.55s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.3s;
}
.name-field:focus-within .hypha { transform: scaleX(1); opacity: 1; }
 
.create select {
  flex: 0 1 210px; width: auto; min-width: 170px; cursor: pointer; appearance: none; padding-right: 42px;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237ee0a4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat; background-position: right 14px center; background-size: 16px;
}
.create select option { background-color: #16221c; color: #fff; }
 
.submit {
  padding: 0 28px; font: inherit; font-size: 1rem; font-weight: 600; letter-spacing: 0.01em; color: #07210f;
  background: linear-gradient(180deg, #9af0bb, #6fd69a); border: 0; border-radius: 11px; cursor: pointer;
  box-shadow: 0 8px 24px rgba(126, 224, 164, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.15s, box-shadow 0.25s, filter 0.25s, opacity 0.25s;
}
.submit:hover:not(:disabled) { filter: brightness(1.07); box-shadow: 0 10px 30px rgba(126, 224, 164, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35); }
.submit:active:not(:disabled) { transform: translateY(1px); }
.submit:disabled { opacity: 0.4; cursor: not-allowed; }
.submit:focus-visible, .remove:focus-visible, .btn:focus-visible, .empty-cta:focus-visible { outline: 2px solid var(--glow); outline-offset: 2px; }
 
.hint {
  flex: 1 0 100%; margin: 0; padding: 0 2px;
  font-family: Cormorant, Georgia, serif; font-style: italic; font-weight: 500; font-size: 1.2rem; color: var(--soft);
}
 
.error {
  margin: 0 0 24px; padding: 10px 12px; font-size: 0.92rem; line-height: 1.4; color: #ffc9c0;
  background: rgba(255, 110, 90, 0.1); border-left: 3px solid var(--danger); border-radius: 4px 8px 8px 4px;
}
 
/* ── Список: карти ростуть гілками з однієї нитки ── */
.list {
  position: relative; list-style: none; margin: 0; padding: 0 0 0 var(--pad);
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; /* minmax(0,…): довга назва не розпирає список */
}
/* нитка тягнеться від форми вниз і розчиняється */
.list::before {
  content: ''; position: absolute; left: calc(var(--pad) - 26px); top: -44px; bottom: 4px; width: 1px;
  background: linear-gradient(rgba(126, 224, 164, 0.5) 0%, rgba(126, 224, 164, 0.38) 80%, rgba(126, 224, 164, 0));
}
/* по нитці час від часу біжить вогник, як на екрані входу */
.list::after {
  content: ''; position: absolute; left: calc(var(--pad) - 27px); top: -44px; width: 3px; height: 14px; border-radius: 2px;
  background: linear-gradient(rgba(210, 255, 230, 0), #d2ffe6); box-shadow: 0 0 8px var(--glow);
  opacity: 0; pointer-events: none;
  animation: spark 7s ease-in 1.8s infinite;
}
@keyframes spark {
  from { top: -58px; opacity: 0; }
  6% { opacity: 1; }
  45%, to { top: calc(100% - 40px); opacity: 0; }
}
 
.item {
  position: relative; display: flex; align-items: center; gap: 16px; padding: 14px 14px 14px 14px;
  background: rgba(20, 32, 26, 0.72); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
  transition: border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
  animation: fade-up 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
/* вузол на нитці — там, де гілка відходить від неї */
.item::before {
  content: ''; position: absolute; left: -30px; top: calc(50% - var(--curve)); width: 9px; height: 9px; margin-top: -4.5px;
  border-radius: 50%; background: #0f1713; border: 1.5px solid rgba(126, 224, 164, 0.7); box-sizing: border-box;
  transition: background 0.25s, box-shadow 0.25s, transform 0.25s;
}
/* гілочка плавно вигинається від нитки до картки */
.item::after {
  content: ''; position: absolute; left: -26px; top: calc(50% - var(--curve)); width: 26px; height: var(--curve);
  border-left: 1px solid rgba(126, 224, 164, 0.32); border-bottom: 1px solid rgba(126, 224, 164, 0.32);
  border-bottom-left-radius: var(--curve); pointer-events: none;
  transition: border-color 0.25s;
}
.item:hover {
  border-color: rgba(126, 224, 164, 0.4); background: rgba(24, 38, 31, 0.85);
  box-shadow: 0 0 0 1px rgba(126, 224, 164, 0.06), 0 14px 40px rgba(0, 0, 0, 0.4);
}
.item:hover::before { background: var(--glow); box-shadow: 0 0 12px var(--glow); transform: scale(1.2); }
.item:hover::after { border-color: rgba(126, 224, 164, 0.75); }
 
/* ── Відбиток спори: у кожної карти свій ── */
.print {
  flex: none; width: 56px; height: 56px; box-sizing: border-box; padding: 2px;
  background: radial-gradient(circle at 50% 55%, rgba(126, 224, 164, 0.12), rgba(8, 16, 12, 0.55) 70%);
  border: 1px solid var(--line); border-radius: 13px;
  filter: drop-shadow(0 0 4px rgba(126, 224, 164, 0.25));
  transition: border-color 0.25s, filter 0.25s;
}
.print path {
  fill: none; stroke: rgba(126, 224, 164, 0.7); stroke-width: 1.15; stroke-linecap: round;
  stroke-dasharray: 1; stroke-dashoffset: 0;
}
.print circle { fill: #d2ffe6; }
.item:hover .print { border-color: rgba(126, 224, 164, 0.5); filter: drop-shadow(0 0 6px rgba(126, 224, 164, 0.5)); }
/* при наведенні гілки відростають заново */
.item:hover .print path { animation: grow 1s cubic-bezier(0.3, 0.6, 0.2, 1) both; }
@keyframes grow { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
 
.body { flex: 1; min-width: 0; }
.name {
  display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: Cormorant, Georgia, serif; font-weight: 600; font-size: 1.65rem; line-height: 1.15;
  color: var(--ink); text-decoration: none; transition: color 0.2s;
}
/* вся картка клікабельна */
.name::after { content: ''; position: absolute; inset: 0; border-radius: 14px; }
.name:focus-visible { outline: none; }
.name:focus-visible::after { outline: 2px solid var(--glow); outline-offset: 2px; }
.item:hover .name { color: #fff; }
.when { display: block; margin-top: 5px; font-size: 0.88rem; color: var(--soft); }
 
/* ── Видалення ── */
.remove {
  position: relative; z-index: 1; display: grid; place-items: center; flex: none; width: 40px; height: 40px; padding: 0;
  color: #cfa8a2; background: none; border: 0; border-radius: 10px; cursor: pointer; opacity: 0.55;
  transition: color 0.2s, background 0.2s, opacity 0.2s;
}
.remove svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.item:hover .remove, .remove:focus-visible { opacity: 1; }
.remove:hover { color: #ff9f90; background: rgba(255, 110, 90, 0.13); opacity: 1; }
@media (hover: none) { .remove { opacity: 1; } }
 
/* підтвердження прямо в картці, замість системного confirm() */
.item.is-confirming { border-color: rgba(255, 138, 120, 0.45); }
.item.is-confirming::after { border-color: rgba(255, 138, 120, 0.5); }
.item.is-confirming::before { border-color: rgba(255, 138, 120, 0.8); }
.confirm {
  position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; flex: none;
  animation: fade-in 0.2s ease both;
}
.confirm-text {
  margin-right: 4px; font-family: Cormorant, Georgia, serif; font-style: italic; font-weight: 500;
  font-size: 1.25rem; color: #f2c4bc;
}
.btn {
  padding: 9px 14px; font: inherit; font-size: 0.9rem; font-weight: 600; border: 1px solid transparent; border-radius: 9px;
  cursor: pointer; transition: filter 0.2s, background 0.2s, border-color 0.2s;
}
.btn-ghost { color: var(--soft); background: rgba(126, 224, 164, 0.08); border-color: var(--line); }
.btn-ghost:hover { background: rgba(126, 224, 164, 0.16); border-color: rgba(126, 224, 164, 0.45); }
.btn-danger { color: #2a0b07; background: linear-gradient(180deg, #ffb4a6, #f0877a); }
.btn-danger:hover { filter: brightness(1.07); }
 
/* ── Завантаження і порожній стан ── */
.skeleton {
  height: 86px; border: 1px solid var(--line); border-radius: 14px;
  background: linear-gradient(90deg, rgba(20, 32, 26, 0.6) 25%, rgba(126, 224, 164, 0.09) 50%, rgba(20, 32, 26, 0.6) 75%);
  background-size: 220% 100%; animation: shimmer 1.8s ease-in-out infinite;
}
@keyframes shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
 
.empty {
  display: grid; justify-items: center; gap: 6px;
  padding: 32px 24px 36px; text-align: center; border: 1px dashed var(--line); border-radius: 18px;
  background: rgba(20, 32, 26, 0.4);
  animation: fade-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s both;
}
.empty p {
  margin: 0; max-width: 28ch;
  font-family: Cormorant, Georgia, serif; font-style: italic; font-weight: 500; font-size: 1.6rem; line-height: 1.3; color: var(--soft);
}
/* «насінина»: один вузол, з якого вже тягнуться перші нитки */
.seed { width: 132px; height: auto; margin-bottom: 6px; overflow: visible; }
.seed path {
  fill: none; stroke: rgba(126, 224, 164, 0.4); stroke-width: 1.2; stroke-linecap: round;
}
.seed .tip { fill: rgba(210, 255, 230, 0.7); }
.seed .root {
  fill: #d2ffe6; filter: drop-shadow(0 0 6px var(--glow));
  animation: pulse 3.6s ease-in-out infinite;
}
@keyframes pulse { 50% { opacity: 0.55; } }
 
.empty-cta {
  margin-top: 14px; padding: 10px 20px; font: inherit; font-size: 0.95rem; font-weight: 600; color: var(--glow);
  background: rgba(126, 224, 164, 0.08); border: 1px solid rgba(126, 224, 164, 0.4); border-radius: 11px; cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.empty-cta:hover { background: rgba(126, 224, 164, 0.16); border-color: rgba(126, 224, 164, 0.7); }
 
@keyframes fade-up { from { opacity: 0; transform: translateY(14px); } }
@keyframes fade-in { from { opacity: 0; } }
 
@media (max-width: 560px) {
  .maps-container { --pad: 30px; padding: 36px 14px 70px; }
  .create { padding: 16px; }
  .create select, .submit { flex: 1 1 100%; }
  .submit { padding: 14px 18px; }
  .item { flex-wrap: wrap; gap: 12px 14px; }
  .print { width: 48px; height: 48px; }
  .name { font-size: 1.45rem; }
  .confirm { flex: 1 1 100%; justify-content: flex-end; }
}
 
@media (prefers-reduced-motion: reduce) {
  .head, .create, .item, .empty, .confirm { animation: none; }
  .list::after, .skeleton, .seed .root { animation: none; }
  .list::after { display: none; }
  .hypha, .item, .item::before, .item::after { transition: none; }
  .item:hover .print path { animation: none; }
}
</style>
 