<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import NodeItem from '../components/NodeItem.vue';
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
</script>

<template>
  <RouterLink to="/maps" class="muted">← До списку карт</RouterLink>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="store.map">
    <h1>{{ store.map.title }}</h1>
    <p class="muted">Розкладка: {{ store.map.layout }} · вузлів: {{ store.root?.size() }}</p>
    <div class="card">
      <ul class="tree"><NodeItem v-if="store.root" :node="store.root" /></ul>
      <p class="muted note">
        Клацни на текст, щоб змінити (Enter — зберегти, Esc — скасувати). Кнопки ＋ і ✕ з'являються при наведенні.
        Полотно з розкладками буде наступним кроком.
      </p>
    </div>
  </template>
</template>

<style scoped>
.tree { margin: 0; padding: 0; }
.note { margin: 20px 0 0; font-size: 0.875rem; }
</style>
