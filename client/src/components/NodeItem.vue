<script setup>
// Временное отображение дерева списком с редактированием.
// На следующем шаге заменим его полотном (SVG) с раскладками.
import { nextTick, ref } from 'vue';
import { useMapEditorStore } from '../stores/mapEditor';

const props = defineProps({ node: { type: Object, required: true } });
const store = useMapEditorStore();

const editing = ref(false);
const draft = ref('');
const input = ref(null);
const error = ref('');

async function guard(action) {
  error.value = '';
  try {
    await action();
  } catch (err) {
    error.value = err.message;
  }
}

async function startEdit() {
  draft.value = props.node.text;
  editing.value = true;
  await nextTick();
  input.value?.select();
}

async function commit() {
  if (!editing.value) return;
  editing.value = false;
  const text = draft.value.trim();
  if (text === props.node.text) return;
  await guard(() => store.rename(props.node.id, text));
}

const cancel = () => (editing.value = false);

const addChild = () =>
  guard(async () => {
    const child = await store.addChild(props.node.id);
    // Раскрываем ветку, чтобы новый узел был виден
    if (props.node.collapsed) await store.toggleCollapsed(props.node.id);
    return child;
  });

const remove = () => {
  const count = props.node.size();
  const msg = count > 1 ? `Видалити «${props.node.text}» разом з ${count - 1} вкладеними?` : `Видалити «${props.node.text}»?`;
  if (confirm(msg)) guard(() => store.remove(props.node.id));
};
</script>

<template>
  <li>
    <div class="row">
      <button
        v-if="!node.isLeaf"
        class="icon"
        :aria-label="node.collapsed ? 'Розгорнути' : 'Згорнути'"
        @click="guard(() => store.toggleCollapsed(node.id))"
      >{{ node.collapsed ? '▸' : '▾' }}</button>
      <span v-else class="dot" />

      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="edit"
        maxlength="2000"
        aria-label="Текст вузла"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="cancel"
        @blur="commit"
      />
      <span v-else class="text" :class="{ root: node.isRoot }" title="Клацни, щоб змінити" @click="startEdit">
        {{ node.text || 'без тексту' }}
      </span>

      <span v-if="node.collapsed && !node.isLeaf" class="muted count">+{{ node.size() - 1 }}</span>

      <span class="actions">
        <button class="icon" aria-label="Додати вкладений вузол" title="Додати вкладений" @click="addChild">＋</button>
        <button v-if="!node.isRoot" class="icon danger" aria-label="Видалити" title="Видалити" @click="remove">✕</button>
      </span>
    </div>
    <p v-if="error" class="error small" role="alert">{{ error }}</p>

    <ul v-if="!node.isLeaf && !node.collapsed">
      <NodeItem v-for="child in node.children" :key="child.id" :node="child" />
    </ul>
  </li>
</template>

<style scoped>
li { list-style: none; margin: 4px 0; }
ul { margin: 2px 0 0; padding-left: 22px; border-left: 1px dashed var(--border); }
.row { display: flex; align-items: center; gap: 8px; min-height: 30px; }
.dot { width: 8px; height: 8px; margin: 0 7px; border-radius: 50%; background: var(--muted); flex: none; }
.text { cursor: text; padding: 2px 6px; border-radius: 6px; }
.text:hover { background: var(--surface-2); }
.text.root { font-weight: 650; color: var(--accent); }
.edit { flex: 1; max-width: 420px; padding: 4px 8px !important; }
.count { font-size: 0.8rem; }
.actions { display: inline-flex; gap: 2px; margin-left: auto; opacity: 0; transition: opacity 0.12s; }
.row:hover .actions, .row:focus-within .actions { opacity: 1; }
.icon { background: none; border: 0; color: var(--muted); cursor: pointer; font: inherit; padding: 2px 6px; border-radius: 6px; }
.icon:hover { color: var(--accent); background: var(--surface-2); }
.icon.danger:hover { color: var(--danger); }
.small { margin: 2px 0 0 30px; font-size: 0.8rem; }
</style>
