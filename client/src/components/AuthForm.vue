<script setup>
import { ref } from 'vue';
import { pickQuote } from '../core/quotes';
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
const quote = pickQuote();

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
  <div class="welcome">
    <p class="wordmark">Mycelia</p>
    <p class="quote">{{ quote }}</p>
    <span class="thread" aria-hidden="true" />
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
  </div>
</template>

<style scoped>
.welcome {
  position: relative; z-index: 1; min-height: 100vh; padding: 32px 16px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.wordmark {
  margin: 0; font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: clamp(3.4rem, 9vw, 5.6rem);
  line-height: 1; letter-spacing: -0.02em; color: #d9f6e4;
  text-shadow: 0 0 32px rgba(126, 224, 164, 0.35), 0 0 4px rgba(190, 247, 214, 0.4);
}
.quote {
  margin: 14px 0 0; max-width: 30ch; text-align: center;
  font-family: Cormorant, Georgia, serif; font-style: italic; font-weight: 500; font-size: clamp(1.2rem, 2.6vw, 1.5rem);
  line-height: 1.35; color: var(--muted);
}
/* Нитка від цитати до форми: по ній періодично біжить вогник, як по грибниці на фоні */
.thread {
  position: relative; width: 1px; height: 36px; margin: 10px 0 12px; overflow: hidden;
  background: linear-gradient(rgba(126, 224, 164, 0), rgba(126, 224, 164, 0.5));
}
.thread::after {
  content: ''; position: absolute; left: -1px; width: 3px; height: 12px; border-radius: 2px;
  background: linear-gradient(rgba(210, 255, 230, 0), #d2ffe6); box-shadow: 0 0 8px #7ee0a4;
  animation: spark 3.2s ease-in infinite;
}
@keyframes spark { from { top: -14px; } 60%, to { top: 38px; } }
.form {
  width: 100%; max-width: 420px;
  background: rgba(22, 34, 28, 0.78); backdrop-filter: blur(10px);
  box-shadow: 0 0 0 1px rgba(126, 224, 164, 0.06), 0 24px 60px rgba(0, 0, 0, 0.45);
}
.form h1 { font-size: 1.35rem; }
.alt { margin: 16px 0 0; font-size: 0.9rem; }
@media (prefers-reduced-motion: reduce) { .thread::after { animation: none; display: none; } }
</style>
