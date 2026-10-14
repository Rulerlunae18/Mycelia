import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/maps' },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guestOnly: true, bare: true } },
    { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { guestOnly: true, bare: true } },
    { path: '/maps', name: 'maps', component: () => import('../views/MapsView.vue'), meta: { requiresAuth: true } },
    { path: '/maps/:id', name: 'editor', component: () => import('../views/EditorView.vue'), meta: { requiresAuth: true, wide: true } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.loaded) await auth.fetchMe();
  if (to.meta.requiresAuth && !auth.user) return { name: 'login' };
  if (to.meta.guestOnly && auth.user) return { name: 'maps' };
});

export default router;
