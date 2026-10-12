<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../api/http';
import { useTabsStore } from '../stores/tabs';

const router = useRouter();
const tabs = useTabsStore();
const maps = ref([]);
const title = ref('');
const loading = ref(true);
const templates = ref([]); // зразки з сервера для нової карти
const template = ref('');
const error = ref('');

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

async function remove(map) {
  if (!confirm(`Видалити карту «${map.title}»?`)) return;
  try {
    await http.delete(`/maps/${map.id}`);
    maps.value = maps.value.filter((m) => m.id !== map.id);
    tabs.close(map.id);
  } catch (err) {
    error.value = err.message;
  }
}

const fmt = (d) => new Date(d).toLocaleDateString('uk-UA');
onMounted(load);
</script>

<template>
  <h1>Мої карти</h1>

  <form class="create card" @submit.prevent="create">
    <input v-model="title" type="text" placeholder="Назва нової карти" maxlength="120" aria-label="Назва нової карти" />
    <select v-model="template" aria-label="Шаблон">
      <option value="">Порожня карта</option>
      <option v-for="t in templates" :key="t.key" :value="t.key" :title="t.description">{{ t.title }}</option>
    </select>
    <button class="btn btn-primary" :disabled="!title.trim()">Створити</button>
  </form>

  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <p v-if="loading" class="muted">Завантаження…</p>
  <p v-else-if="!maps.length" class="muted">Карт поки немає. Створи першу.</p>

  <ul v-else class="list">
    <li v-for="m in maps" :key="m.id" class="card item">
      <RouterLink :to="{ name: 'editor', params: { id: m.id } }" class="name">{{ m.title }}</RouterLink>
      <span class="muted">оновлено {{ fmt(m.updatedAt) }}</span>
      <button class="btn btn-small btn-danger" @click="remove(m)">Видалити</button>
    </li>
  </ul>
</template>

<style scoped>
.create { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
.create select { font: inherit; padding: 0 10px; color: var(--text); background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; }
.create input { flex: 1; min-width: 200px; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.item { display: flex; align-items: center; gap: 16px; padding: 14px 18px; }
.name { flex: 1; font-weight: 600; }
</style>
