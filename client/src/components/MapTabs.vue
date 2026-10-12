<script setup>
// Вкладки відкритих карт. Лише показує і повідомляє подіями: куди перейти, що закрити,
// що перейменувати. Адресою й даними займається сторінка редактора.
import { nextTick, ref } from 'vue';

defineProps({
  tabs: { type: Array, required: true },
  activeId: { type: String, default: null },
});
const emit = defineEmits(['close', 'rename']);

// Перейменування лише активної вкладки: подвійний клік по назві
const editing = ref(null); // { id, text }

async function startRename(tab) {
  editing.value = { id: tab.id, text: tab.title };
  await nextTick();
  document.querySelector('.tab-input')?.select();
}

function commit() {
  const e = editing.value;
  if (!e) return;
  editing.value = null;
  if (e.text.trim()) emit('rename', { id: e.id, title: e.text.trim() });
}
</script>

<template>
  <nav class="tabs" aria-label="Відкриті карти">
    <div
      v-for="t in tabs"
      :key="t.id"
      class="tab"
      :class="{ active: t.id === activeId }"
      @auxclick.middle.prevent="emit('close', t.id)"
    >
      <input
        v-if="editing?.id === t.id"
        v-model="editing.text"
        class="tab-input"
        maxlength="120"
        aria-label="Назва карти"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="editing = null"
        @blur="commit"
      />
      <RouterLink
        v-else
        :to="{ name: 'editor', params: { id: t.id } }"
        class="title"
        :aria-current="t.id === activeId ? 'page' : undefined"
        :title="t.id === activeId ? 'Двічі клацни, щоб перейменувати' : t.title"
        @dblclick.prevent="t.id === activeId && startRename(t)"
      >{{ t.title }}</RouterLink>
      <button class="close" :aria-label="`Закрити вкладку ${t.title}`" @click="emit('close', t.id)">✕</button>
    </div>
    <RouterLink to="/maps" class="add" aria-label="Усі карти і створення нової" title="Усі карти">＋</RouterLink>
  </nav>
</template>

<style scoped>
.tabs { display: flex; flex-wrap: wrap; align-items: stretch; gap: 4px; margin-bottom: 14px; }
.tab { display: inline-flex; align-items: center; max-width: 220px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.tab.active { background: var(--surface-2); border-color: var(--accent); }
.title { padding: 6px 4px 6px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 0.9rem; }
.title:hover { text-decoration: none; color: var(--text); }
.active .title { color: var(--text); font-weight: 600; }
.close { border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 6px 10px 6px 4px; font-size: 0.75rem; }
.close:hover { color: var(--danger); }
.tab-input { font: inherit; font-size: 0.9rem; width: 160px; margin: 3px 6px 3px 8px; padding: 2px 6px; color: var(--text); background: var(--bg); border: 1px solid var(--accent); border-radius: 6px; outline: none; }
.add { display: inline-flex; align-items: center; padding: 0 12px; border: 1px dashed var(--border); border-radius: 10px; color: var(--muted); }
.add:hover { text-decoration: none; color: var(--accent); border-color: var(--accent); }
</style>
