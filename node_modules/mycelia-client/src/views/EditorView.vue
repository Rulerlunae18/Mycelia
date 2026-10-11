<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { http } from '../api/http';
import NodeItem from '../components/NodeItem.vue';
import { TreeNode } from '../core/TreeNode';

const route = useRoute();
const map = ref(null);
const error = ref('');

const root = computed(() => (map.value ? TreeNode.fromFlat(map.value.nodes) : null));

onMounted(async () => {
  try {
    map.value = (await http.get(`/maps/${route.params.id}`)).map;
  } catch (err) {
    error.value = err.message;
  }
});
</script>

<template>
  <RouterLink to="/maps" class="muted">← До списку карт</RouterLink>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="map">
    <h1>{{ map.title }}</h1>
    <p class="muted">Розкладка: {{ map.layout }} · вузлів: {{ root?.size() }}</p>
    <div class="card">
      <ul class="tree"><NodeItem v-if="root" :node="root" /></ul>
      <p class="muted note">Тут буде полотно редактора. Поки що це дерево з бази даних, зібране через Composite.</p>
    </div>
  </template>
</template>

<style scoped>
.tree { margin: 0; padding: 0; }
.note { margin: 20px 0 0; font-size: 0.875rem; }
</style>
