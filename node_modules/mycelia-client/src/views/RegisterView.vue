<script setup>
import { useRouter } from 'vue-router';
import AuthForm from '../components/AuthForm.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

async function submit(email, password) {
  await auth.register(email, password);
  router.push({ name: 'maps' });
}
</script>

<template>
  <AuthForm title="Реєстрація" submit-label="Створити акаунт" :on-submit="submit">
    Уже є акаунт? <RouterLink to="/login">Увійти</RouterLink>
  </AuthForm>
</template>
