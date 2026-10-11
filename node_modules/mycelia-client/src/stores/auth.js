import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ApiError, http } from '../api/http';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const loaded = ref(false);

  // Викликається один раз при старті: чи є дійсна сесія (cookie)
  async function fetchMe() {
    try {
      user.value = (await http.get('/auth/me')).user;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
      user.value = null;
    } finally {
      loaded.value = true;
    }
  }

  async function login(email, password) {
    user.value = (await http.post('/auth/login', { email, password })).user;
  }

  async function register(email, password) {
    user.value = (await http.post('/auth/register', { email, password })).user;
  }

  async function logout() {
    await http.post('/auth/logout');
    user.value = null;
  }

  return { user, loaded, fetchMe, login, register, logout };
});
