<script setup>
import { useRouter } from 'vue-router';
import AuthForm from '../components/AuthForm.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

async function submit(email, password) {
  await auth.login(email, password);
  router.push({ name: 'maps' });
}
</script>

<template>
  <AuthForm title="Вхід" submit-label="Увійти" :on-submit="submit">
    Немає акаунта? <RouterLink to="/register">Зареєструватися</RouterLink>
  </AuthForm>
</template>
