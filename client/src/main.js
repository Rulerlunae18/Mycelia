import '@fontsource/fraunces/600.css';
import '@fontsource/cormorant/500-italic.css';
import '@fontsource/kaushan-script';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './style.css';

createApp(App).use(createPinia()).use(router).mount('#app');
