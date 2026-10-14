<script setup>
// Нотатка вибраного вузла: довгий текст, якому тісно в самому вузлі. Зберігається сама:
// через паузу після друку, при виході з поля і при зміні вибраного вузла. Сама нічого
// не шле на сервер, лише повідомляє подією save.
import { onBeforeUnmount, ref, watch } from 'vue';

const MAX = 10000;
const AUTOSAVE_MS = 1200;

const props = defineProps({
  nodeId: { type: String, required: true },
  nodeTitle: { type: String, default: '' },
  note: { type: String, default: '' }, // збережене значення
});
const emit = defineEmits(['save']);

const draft = ref(props.note ?? '');
const dirty = ref(false);
let timer = 0;

function flush(id = props.nodeId) {
  clearTimeout(timer);
  if (!dirty.value) return;
  dirty.value = false;
  emit('save', { id, note: draft.value });
}

function onInput() {
  dirty.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => flush(), AUTOSAVE_MS);
}

// Інший вузол: спершу зберігаємо незбережене від попереднього, потім показуємо нове
watch(() => props.nodeId, (_id, previous) => {
  flush(previous);
  draft.value = props.note ?? '';
});

// Значення змінилося ззовні (скасування, повтор): оновлюємо поле, якщо користувач зараз не друкує
watch(() => props.note, (value) => {
  if (!dirty.value) draft.value = value ?? '';
});

onBeforeUnmount(() => flush());
</script>

<template>
  <section class="card" aria-label="Нотатка до вузла">
    <header>
      <h2>Нотатка: <span class="muted">{{ nodeTitle || 'без тексту' }}</span></h2>
      <span class="status muted" aria-live="polite">{{ dirty ? 'Зберігається…' : draft ? 'Збережено' : '' }}</span>
    </header>
    <textarea
      v-model="draft"
      class="note"
      rows="6"
      :maxlength="MAX"
      placeholder="Тут можна розписати ідею повністю: аргументи, приклади, посилання. У вузлі лишиться лише коротка назва."
      aria-label="Текст нотатки"
      @input="onInput"
      @blur="flush()"
    />
    <p class="muted count" :class="{ near: draft.length > MAX * 0.9 }">{{ draft.length }} / {{ MAX }}</p>
  </section>
</template>

<style scoped>
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { margin: 0; font-family: var(--serif); font-size: 1.5rem; font-weight: 600; color: var(--ink); line-height: 1.2; }
h2 .muted { font-style: italic; font-weight: 500; color: var(--soft); }
.status { font-size: 0.85rem; }
.note {
  display: block; width: 100%; margin-top: 12px; padding: 12px 14px; box-sizing: border-box; resize: vertical;
  min-height: 8em; max-height: 60vh; font: inherit; line-height: 1.55; color: var(--ink);
  background: rgb(var(--deep-rgb) / 0.55); border: 1px solid var(--line); border-radius: 12px;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}
.note::placeholder { color: color-mix(in srgb, var(--soft) 45%, transparent); }
.note:focus { outline: none; border-color: rgb(var(--glow-rgb) / 0.6); background: rgb(var(--deep-rgb) / 0.8); box-shadow: 0 0 0 3px rgb(var(--glow-rgb) / 0.12); }
.count { margin: 6px 0 0; font-size: 0.8rem; text-align: right; }
.count.near { color: var(--danger); }
</style>
