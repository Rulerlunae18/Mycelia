<script setup>
// Вкладення вибраного вузла: список із попереднім переглядом (картинка, відео),
// завантаження кнопкою або перетягуванням файлів. Сам нічого не вантажить, а лише
// повідомляє подіями; адреси файлів будує через fileUrl.
import { ref } from 'vue';
import { apiUrl } from '../api/http';
import { fileUrl, formatSize } from '../core/attachments';

defineProps({
  mapId: { type: String, required: true },
  nodeTitle: { type: String, default: '' },
  attachments: { type: Array, required: true },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['upload', 'remove']);

const over = ref(false);
const input = ref(null);

function pick(files) {
  const list = [...files];
  if (list.length) emit('upload', list);
  if (input.value) input.value.value = ''; // щоб той самий файл можна було вибрати знову
}
const src = (mapId, id) => fileUrl(apiUrl, mapId, id);
</script>

<template>
  <section
    class="panel card"
    :class="{ over }"
    aria-label="Вкладення вузла"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="over = false; pick($event.dataTransfer.files)"
  >
    <header>
      <h2>Вкладення: <span class="muted">{{ nodeTitle || 'без тексту' }}</span></h2>
      <label class="btn btn-small" :class="{ disabled: busy }">
        {{ busy ? 'Завантаження…' : '＋ Додати файл' }}
        <input ref="input" type="file" multiple hidden :disabled="busy" @change="pick($event.target.files)" />
      </label>
    </header>

    <p v-if="!attachments.length" class="muted empty">Перетягни сюди файли, картинки чи відео або натисни «Додати файл».</p>

    <ul v-else class="items">
      <li v-for="a in attachments" :key="a.id" class="item">
        <a v-if="a.kind === 'image'" :href="src(mapId, a.id)" target="_blank" rel="noopener" class="preview" :title="`Відкрити «${a.name}»`">
          <img :src="src(mapId, a.id)" :alt="a.name" loading="lazy" />
        </a>
        <video v-else-if="a.kind === 'video'" class="preview" :src="src(mapId, a.id)" controls preload="metadata" :aria-label="a.name" />
        <a v-else :href="src(mapId, a.id)" download class="preview file" :title="`Завантажити «${a.name}»`">📄</a>
        <div class="meta">
          <span class="name" :title="a.name">{{ a.name }}</span>
          <span class="muted">{{ formatSize(a.size) }}</span>
        </div>
        <button class="btn btn-small btn-danger" :aria-label="`Видалити вкладення ${a.name}`" @click="emit('remove', a.id)">✕</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel { transition: border-color 0.2s, background 0.2s, box-shadow 0.2s; }
/* файл над панеллю: нитка стає штриховою і світиться, як область на карті */
.panel.over { border-style: dashed; border-color: var(--glow); background: rgb(var(--glow-rgb) / 0.1); box-shadow: 0 0 28px rgb(var(--glow-rgb) / 0.2); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { margin: 0; font-family: var(--serif); font-size: 1.5rem; font-weight: 600; color: var(--ink); line-height: 1.2; }
h2 .muted { font-style: italic; font-weight: 500; color: var(--soft); }
.btn.disabled { opacity: 0.6; pointer-events: none; }
.empty { margin: 12px 0 0; padding: 20px; text-align: center; border: 1px dashed rgb(var(--glow-rgb) / 0.25); border-radius: 12px; }
.items { list-style: none; margin: 14px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.item { display: grid; grid-template-columns: 96px 1fr auto; gap: 12px; align-items: center; padding: 8px; background: rgb(var(--deep-rgb) / 0.4); border: 1px solid rgb(var(--glow-rgb) / 0.14); border-radius: 12px; }
.preview { width: 96px; height: 72px; object-fit: cover; border-radius: 9px; border: 1px solid var(--line); background: rgb(var(--deep-rgb) / 0.7); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.preview img, video.preview { width: 100%; height: 100%; object-fit: cover; }
.file { font-size: 1.8rem; text-decoration: none; }
.meta { display: grid; min-width: 0; font-size: 0.85rem; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); }
</style>
