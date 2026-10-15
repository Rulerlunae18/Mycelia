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
const showPassword = ref(false)

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
    <form class="card form" @submit.prevent="submit">
    <h1>{{ title }}</h1>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" autocomplete="email" required />
    </div>
    <div class="field">
      <label for="password">Пароль</label>
      <div class="control">
        <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password" minlength="8" required />
        <button type="button" class="reveal"
                :aria-label="showPassword ? 'Сховати пароль' : 'Показати пароль'"
                :aria-pressed="showPassword" @click="showPassword = !showPassword">
          <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9.5c2.2 3 5.2 4.5 9 4.5s6.8-1.5 9-4.5" />
            <path d="M5.6 12.6 4 15M12 14v3M18.4 12.6 20 15" />
          </svg>
        </button>
      </div>
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
  margin: 0; font-family: Kaushan Script, cursive; font-weight: 600; font-size: clamp(3.4rem, 9vw, 5.6rem);
  line-height: 1; letter-spacing: -0.02em; color: var(--spark);
  text-shadow: 0 0 32px rgb(var(--glow-rgb) / 0.35), 0 0 4px rgb(var(--trail-rgb) / 0.4);
  animation: fadeInUp 1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.field label {
  color: #e0e0e0;
  display: block;
  margin-bottom: 6px;
}
.field input {
  width: 100%;
  background: rgb(var(--deep-rgb) / 0.4);
  border: 1px solid rgb(var(--glow-rgb) / 0.2);
  color: #fff;
  padding: 10px 12px;
  border-radius: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
}
.field input:focus {
  border-color: var(--glow);
  outline: none;
  box-shadow: 0 0 0 2px rgb(var(--glow-rgb) / 0.2);
}
.control { position: relative; }
.control input { padding-right: 52px; }
.reveal {
  position: absolute; top: 50%; right: 7px; transform: translateY(-50%);
  display: grid; place-items: center; width: 34px; height: 34px; padding: 0;
  color: var(--soft); background: none; border: 0; border-radius: 9px; cursor: pointer;
}
.reveal svg { width: 20px; height: 20px; fill: none; stroke: currentColor;
  stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.reveal:hover, .reveal[aria-pressed='true'] { color: var(--glow); }
.reveal:focus-visible { outline: 2px solid var(--glow); outline-offset: 2px; }
.quote {
  margin: 35px 0 35px; max-width: 50ch; text-align: center;
  font-family: Cormorant, Georgia, serif; font-style: italic; font-weight: 500; font-size: clamp(1.2rem, 2.6vw, 1.5rem);
  line-height: 1.35; color: #e0e0e0;
  animation: fadeInUp 1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: 0.2s;
}
.form {
  width: 100%; max-width: 420px;
  background: rgb(var(--panel-rgb) / 0.78); backdrop-filter: blur(10px);
  box-shadow: 0 0 0 1px rgb(var(--glow-rgb) / 0.25), 0 24px 60px rgba(0, 0, 0, 0.45);
  animation: fadeInUp 1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: 0.4s;
}
.form h1 { font-size: 1.35rem; }
.alt { margin: 16px 0 0; font-size: 0.9rem; }
.alt :deep(a) {
  color: var(--glow);
  text-decoration: none;
  transition: color 0.2s;
}
.alt :deep(a):hover {
  color: #5bc585;
  text-decoration: underline;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wordmark, .quote, .form {
    animation: none !important;
  }
}
</style>