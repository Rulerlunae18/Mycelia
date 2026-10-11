<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import MapCanvas from '../components/MapCanvas.vue';
import NodeItem from '../components/NodeItem.vue';
import { LAYOUTS, LAYOUT_NAMES } from '../core/layout';
import { useMapEditorStore } from '../stores/mapEditor';

const route = useRoute();
const store = useMapEditorStore();
const error = ref('');

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

const addChild = () => run(() => store.addChildAndSelect(store.selectedId));

function removeSelected() {
  const node = store.selected;
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

      <span class="muted count">вузлів: {{ store.root?.size() }}</span>

      <div class="selection">
        <template v-if="store.selected">
          <span class="muted name">Вибрано: <b>{{ store.selected.text || 'без тексту' }}</b></span>
          <button class="btn btn-small" @click="addChild">＋ Вкладений</button>
          <button v-if="!store.selected.isRoot" class="btn btn-small btn-danger" @click="removeSelected">✕ Видалити</button>
        </template>
        <span v-else class="muted">Клацни вузол, щоб вибрати</span>
      </div>
    </div>

    <MapCanvas
      v-if="store.root"
      :root="store.root"
      :layout="store.layout"
      :selected-id="store.selectedId"
      @select="store.select"
      @toggle="(id) => run(() => store.toggleCollapsed(id))"
    />
    <p class="muted hint">
      Колесо миші: масштаб · перетягни фон, щоб посунути карту · подвійний клік по вузлу згортає і розгортає гілку.
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
.count { font-size: 0.875rem; }
.selection { display: flex; align-items: center; gap: 8px; margin-left: auto; min-width: 0; }
.name { max-width: 28ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { font-size: 0.85rem; margin: 10px 0 20px; }
.outline summary { cursor: pointer; font-weight: 600; }
.tree { margin: 12px 0 0; padding: 0; }
.note { margin: 16px 0 0; font-size: 0.875rem; }
</style>
