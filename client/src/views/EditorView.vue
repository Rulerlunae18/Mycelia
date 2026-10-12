<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import MapCanvas from '../components/MapCanvas.vue';
import NodeItem from '../components/NodeItem.vue';
import { LAYOUTS, LAYOUT_NAMES } from '../core/layout';
import { CATEGORIES, PRIORITIES } from '../core/marks';
import { THEMES, THEME_NAMES } from '../core/theme';
import { useMapEditorStore } from '../stores/mapEditor';

const route = useRoute();
const store = useMapEditorStore();
const error = ref('');
const canvas = ref(null);

onMounted(async () => {
  try {
    await store.load(route.params.id);
  } catch (err) {
    error.value = err.message;
  }
});

async function run(action) {
  error.value = '';
  try {
    await action();
  } catch (err) {
    error.value = err.message;
  }
}

// Новий вузол одразу відкривається для правки: можна друкувати ідеї підряд
async function addAndEdit(create) {
  await run(async () => {
    const node = await create();
    await nextTick();
    canvas.value?.edit(node.id);
  });
}
const addChild = (id = store.selectedId) => addAndEdit(() => store.addChildAndSelect(id));
const addSibling = (id = store.selectedId) => addAndEdit(() => store.addSiblingAndSelect(id));

function removeSelected(id = store.selectedId) {
  const node = store.root?.find(id);
  if (!node || node.isRoot) return;
  const extra = node.size() - 1;
  const text = node.text || 'без тексту';
  const message = extra > 0 ? `Видалити «${text}» разом з ${extra} вкладеними?` : `Видалити «${text}»?`;
  if (confirm(message)) run(() => store.remove(node.id));
}
</script>

<template>
  <RouterLink to="/maps" class="muted">← До списку карт</RouterLink>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="store.map">
    <h1>{{ store.map.title }}</h1>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Розкладка">
        <button
          v-for="name in LAYOUT_NAMES"
          :key="name"
          class="btn btn-small"
          :class="{ active: store.layout === name }"
          :aria-pressed="store.layout === name"
          @click="run(() => store.setLayout(name))"
        >{{ LAYOUTS[name].label }}</button>
      </div>

      <label class="field">
        <span class="muted">Тема</span>
        <select :value="store.theme" aria-label="Тема" @change="run(() => store.setTheme($event.target.value))">
          <option v-for="name in THEME_NAMES" :key="name" :value="name">{{ THEMES[name].label }}</option>
        </select>
      </label>

      <span class="muted count">вузлів: {{ store.root?.size() }}</span>

      <div class="selection">
        <template v-if="store.selected">
          <span class="muted name">Вибрано: <b>{{ store.selected.text || 'без тексту' }}</b></span>
          <select
            :value="store.selected.extra.category ?? ''" aria-label="Категорія"
            @change="run(() => store.patch(store.selectedId, { category: $event.target.value || null }))"
          >
            <option value="">Без категорії</option>
            <option v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.glyph }} {{ c.label }}</option>
          </select>
          <select
            :value="store.selected.extra.priority ?? ''" aria-label="Терміновість"
            @change="run(() => store.patch(store.selectedId, { priority: $event.target.value || null }))"
          >
            <option value="">Без терміновості</option>
            <option v-for="p in PRIORITIES" :key="p.key" :value="p.key">{{ p.glyph }} {{ p.label }}</option>
          </select>
          <button class="btn btn-small" @click="canvas?.edit(store.selectedId)">✎ Текст</button>
          <button class="btn btn-small" @click="addChild()">＋ Вкладений</button>
          <button v-if="!store.selected.isRoot" class="btn btn-small btn-danger" @click="removeSelected()">✕ Видалити</button>
        </template>
        <span v-else class="muted">Клацни вузол, щоб вибрати</span>
      </div>
    </div>

    <MapCanvas
      v-if="store.root"
      ref="canvas"
      :root="store.root"
      :layout="store.layout"
      :theme="store.theme"
      :selected-id="store.selectedId"
      @select="store.select"
      @toggle="(id) => run(() => store.toggleCollapsed(id))"
      @rename="({ id, text }) => run(() => store.rename(id, text))"
      @add-child="addChild"
      @add-sibling="addSibling"
      @remove="removeSelected"
      @move="({ id, parentId, index }) => run(() => store.moveAndReveal(id, parentId, index))"
    />
    <p class="muted hint">
      Колесо миші: масштаб · перетягни фон, щоб посунути карту · подвійний клік по вузлу згортає і розгортає гілку · тягни вузол на середину іншого, щоб зробити його дитиною, або на край, щоб змінити порядок.
      <br />Клавіші: <kbd>Tab</kbd> вкладений · <kbd>Enter</kbd> сусід · <kbd>F2</kbd> текст · <kbd>Delete</kbd> видалити · <kbd>Esc</kbd> зняти виділення.
    </p>

    <details class="card outline">
      <summary>Структура: змінити текст вузлів</summary>
      <ul class="tree"><NodeItem v-if="store.root" :node="store.root" /></ul>
      <p class="muted note">Клацни на текст, щоб змінити (Enter: зберегти, Esc: скасувати).</p>
    </details>
  </template>
</template>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-bottom: 12px; }
.seg { display: inline-flex; gap: 4px; }
.seg .btn.active { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
kbd { font: inherit; font-size: 0.8em; padding: 1px 6px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface-2); }
.field { display: inline-flex; align-items: center; gap: 6px; font-size: 0.875rem; }
select { font: inherit; font-size: 0.85rem; padding: 4px 8px; color: var(--text); background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; max-width: 14ch; }
.count { font-size: 0.875rem; }
.selection { flex-wrap: wrap; display: flex; align-items: center; gap: 8px; margin-left: auto; min-width: 0; }
.name { max-width: 28ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { font-size: 0.85rem; margin: 10px 0 20px; }
.outline summary { cursor: pointer; font-weight: 600; }
.tree { margin: 12px 0 0; padding: 0; }
.note { margin: 16px 0 0; font-size: 0.875rem; }
</style>
