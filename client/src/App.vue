<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
// Екрани входу й реєстрації без шапки: там головне фон і форма
const bare = computed(() => !!route.meta.bare);

async function logout() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <header v-if="!bare" class="topbar">
    <div class="container bar">
      <RouterLink to="/maps" class="brand">Mycelia</RouterLink>
      <div v-if="auth.user" class="user">
        <span class="muted">{{ auth.user.email }}</span>
        <button class="btn btn-small" @click="logout">Вийти</button>
      </div>
    </div>
  </header>
  <main v-if="!bare" class="container page">
    <RouterView />
  </main>
  <RouterView v-else />
</template>

<style scoped>
.topbar { border-bottom: 1px solid var(--border); background: rgba(15, 23, 19, 0.7); backdrop-filter: blur(6px); }
.bar { display: flex; align-items: center; justify-content: space-between; height: 56px; }
.brand { font-weight: 700; font-size: 1.15rem; color: var(--accent); letter-spacing: 0.02em; }
.brand:hover { text-decoration: none; }
.user { display: flex; align-items: center; gap: 12px; }
.page { padding-top: 32px; padding-bottom: 48px; }
</style>
