<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
 
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
// Екрани входу й реєстрації без шапки: там головне фон і форма
const bare = computed(() => !!route.meta.bare);
// перша літера пошти — для «вузла» поруч з email
const initial = computed(() => auth.user?.email?.[0]?.toUpperCase() ?? '');
 
async function logout() {
  await auth.logout();
  router.push({ name: 'login' });
}
</script>
 
<template>
  <header v-if="!bare" class="topbar">
    <div class="bar">
      <RouterLink to="/maps" class="brand">Mycelia</RouterLink>
      <div v-if="auth.user" class="user">
        <span class="email">{{ auth.user.email }}</span>
        <span class="node" :title="auth.user.email" aria-hidden="true">{{ initial }}</span>
        <button class="logout" @click="logout">Вийти</button>
      </div>
    </div>
  </header>
  <main v-if="!bare" class="container page">
    <RouterView />
  </main>
  <RouterView v-else />
</template>
 
<style scoped>
/* ── Шапка: скло, під яким просвічує мицелій, і нитка знизу ── */
.topbar {
  position: relative; z-index: 2; overflow: hidden;
  background: rgba(15, 23, 19, 0.62); backdrop-filter: blur(10px);
}
/* нитка замість звичайної рамки: розчиняється до країв */
.topbar::before {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(126, 224, 164, 0.38) 18%, rgba(126, 224, 164, 0.38) 82%, transparent);
}
/* по нитці зрідка пробігає вогник, як на списку карт */
.topbar::after {
  content: ''; position: absolute; left: -120px; bottom: 0; width: 120px; height: 1px; opacity: 0; pointer-events: none;
  background: linear-gradient(90deg, rgba(210, 255, 230, 0), #d2ffe6);
  box-shadow: 0 0 8px #7ee0a4;
  animation: run 11s ease-in-out 3s infinite;
}
@keyframes run {
  0% { transform: translateX(0); opacity: 0; }
  6% { opacity: 1; }
  50%, 100% { transform: translateX(calc(100vw + 120px)); opacity: 0; }
}
 
/* контент шапки вирівняний по тій самій колонці, що й сторінка карт */
.bar {
  display: flex; align-items: center; justify-content: space-between;
  max-width: none; height: 62px; margin: 0 auto; padding: 0 240px;
}
 
/* ── Логотип: той самий Kaushan Script зі світінням, що на екрані входу ── */
.brand {
  font-family: 'Kaushan Script', cursive; font-size: 1.85rem; line-height: 1; padding: 4px 2px 8px;
  color: #d9fbe6; text-decoration: none; letter-spacing: 0;
  text-shadow: 0 0 4px rgba(210, 255, 230, 0.35), 0 0 20px rgba(126, 224, 164, 0.5);
  transition: text-shadow 0.3s, color 0.3s;
}
.brand:hover { color: #fff; text-decoration: none; text-shadow: 0 0 6px rgba(210, 255, 230, 0.55), 0 0 28px rgba(126, 224, 164, 0.8); }
.brand:focus-visible { outline: 2px solid #7ee0a4; outline-offset: 4px; border-radius: 6px; }
 
/* ── Користувач ── */
.user { display: flex; align-items: center; gap: 12px; }
.email { font-size: 0.92rem; color: #b4cfbf; }
/* «вузол» з літерою: як вузли на нитці у списку */
.node {
  display: grid; place-items: center; flex: none; width: 30px; height: 30px; box-sizing: border-box;
  font-family: Cormorant, Georgia, serif; font-weight: 700; font-size: 1.1rem; color: #d2ffe6;
  background: radial-gradient(circle at 50% 40%, rgba(126, 224, 164, 0.22), rgba(8, 16, 12, 0.7));
  border: 1px solid rgba(126, 224, 164, 0.55); border-radius: 50%;
  box-shadow: 0 0 12px rgba(126, 224, 164, 0.25);
}
 
/* кнопка виходу: тиха, а при наведенні червоніє, як кошик у списку */
.logout {
  padding: 7px 14px; font: inherit; font-size: 0.88rem; font-weight: 600; color: #b4cfbf;
  background: rgba(126, 224, 164, 0.06); border: 1px solid rgba(126, 224, 164, 0.22); border-radius: 9px; cursor: pointer;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
}
.logout:hover { color: #ff9f90; background: rgba(255, 110, 90, 0.1); border-color: rgba(255, 138, 120, 0.45); }
.logout:focus-visible { outline: 2px solid #7ee0a4; outline-offset: 2px; }
 
/* відступ сторінки лишаємо малим: свій відступ задає кожна сторінка */
.page { padding-top: 12px; padding-bottom: 48px; }
 
@media (max-width: 560px) {
  .bar { padding: 0 14px; height: 56px; }
  .brand { font-size: 1.6rem; }
  .email { display: none; }
}
 
@media (prefers-reduced-motion: reduce) {
  .topbar::after { display: none; animation: none; }
  .brand, .logout { transition: none; }
}
</style>
 