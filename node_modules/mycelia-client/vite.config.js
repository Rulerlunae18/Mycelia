import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // У розробці запити /api йдуть на сервер: cookie працює без налаштувань CORS
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
