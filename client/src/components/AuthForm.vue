<script setup>
import { ref } from 'vue';
import MyceliumBackdrop from './MyceliumBackdrop.vue';

const props = defineProps({
  title: { type: String, required: true },
  submitLabel: { type: String, required: true },
  // async (email, password) => void; кидає помилку з message
  onSubmit: { type: Function, required: true },
});

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await props.onSubmit(email.value, password.value);
  } catch (err) {
    error.value = err.message || 'Щось пішло не так';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <MyceliumBackdrop />
  <form class="card form" @submit.prevent="submit">
    <h1>{{ title }}</h1>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" autocomplete="email" required />
    </div>
    <div class="field">
      <label for="password">Пароль</label>
      <input id="password" v-model="password" type="password" autocomplete="current-password" minlength="8" required />
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <button class="btn btn-primary" :disabled="busy">{{ submitLabel }}</button>
    <p class="muted alt"><slot /></p>
  </form>
</template>

<style scoped>
.form {
  position: relative; z-index: 1; max-width: 420px; margin: 8vh auto 0;
  background: rgba(22, 34, 28, 0.78); backdrop-filter: blur(10px);
  box-shadow: 0 0 0 1px rgba(126, 224, 164, 0.06), 0 24px 60px rgba(0, 0, 0, 0.45);
}
.alt { margin: 16px 0 0; font-size: 0.9rem; }
</style>
