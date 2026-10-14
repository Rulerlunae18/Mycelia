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
      <i class="bud" aria-hidden="true" />
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
.tabs { display: flex; flex-wrap: wrap; align-items: stretch; gap: 8px; margin-bottom: 22px; }
.tab {
  position: relative; display: inline-flex; align-items: center; max-width: 240px; padding-left: 12px;
  background: rgb(var(--panel-rgb) / 0.6); backdrop-filter: blur(8px);
  border: 1px solid var(--line); border-radius: 12px;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}
.tab:hover { border-color: rgb(var(--glow-rgb) / 0.45); }
/* «бруньки» на нитці: у активної вкладки світиться */
.bud { flex: none; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid rgb(var(--glow-rgb) / 0.55); background: var(--bg); transition: background 0.25s, box-shadow 0.25s; }
.tab.active { background: rgba(26, 42, 34, 0.9); border-color: rgb(var(--glow-rgb) / 0.6); box-shadow: 0 0 18px rgb(var(--glow-rgb) / 0.12); }
.tab.active .bud { background: var(--glow); border-color: var(--glow); box-shadow: 0 0 10px var(--glow); }
.tab.active::after {
  content: ''; position: absolute; left: 14px; right: 14px; bottom: -1px; height: 1px;
  background: linear-gradient(90deg, transparent, var(--glow), transparent);
}
.title {
  padding: 8px 4px 8px 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: var(--serif); font-size: 1.15rem; font-weight: 600; line-height: 1.2; color: var(--soft);
}
.title:hover { text-decoration: none; color: var(--ink); }
.active .title { color: var(--ink); }
.close { border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 8px 11px 8px 5px; font-size: 0.72rem; border-radius: 10px; transition: color 0.2s; }
.close:hover { color: #ff9f90; }
.tab-input {
  font: inherit; font-family: var(--serif); font-size: 1.1rem; font-weight: 600; width: 170px; margin: 4px 6px 4px 8px; padding: 2px 8px;
  color: var(--ink); background: rgb(var(--deep-rgb) / 0.7); border: 1px solid var(--glow); border-radius: 8px; outline: none;
}
.add {
  display: inline-flex; align-items: center; padding: 0 15px; font-size: 1.1rem; color: var(--muted);
  border: 1px dashed rgb(var(--glow-rgb) / 0.35); border-radius: 12px; transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.add:hover { text-decoration: none; color: var(--glow); border-color: var(--glow); background: rgb(var(--glow-rgb) / 0.07); }
</style>
