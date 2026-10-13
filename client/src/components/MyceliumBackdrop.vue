<script setup>
// Фон екрана входу: нитки грибниці й світлові імпульси, що біжать по них від коренів до кінчиків.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { growNetwork, makeRng, pickRoute, pointAt } from '../core/mycelium';

const canvas = ref(null);
let nodes = [];
let still = null; // готовий шар ниток, перемальовується лише при зміні розміру
let pulses = [];
let raf = 0;
let last = 0;
let width = 0;
let height = 0;
let dpr = 1;
let observer = null;
let resizeTimer = 0;
const rng = makeRng(Date.now() % 100000);
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const THREAD = '126, 224, 164';

function paintStill() {
  still = document.createElement('canvas');
  still.width = Math.ceil(width * dpr);
  still.height = Math.ceil(height * dpr);
  const g = still.getContext('2d');
  g.scale(dpr, dpr);
  g.lineCap = 'round';
  // Тонші й тьмяніші нитки для молодших гілок: так видно, де «стовбур»
  for (let gen = 0; gen <= 4; gen++) {
    g.beginPath();
    for (const n of nodes) {
      if (n.parent === -1 || n.gen !== gen) continue;
      const p = nodes[n.parent];
      g.moveTo(p.x, p.y);
      g.lineTo(n.x, n.y);
    }
    g.strokeStyle = `rgba(${THREAD}, ${0.2 - gen * 0.033})`;
    g.lineWidth = Math.max(0.6, 1.9 - gen * 0.38);
    g.stroke();
  }
}

function rebuild() {
  if (!canvas.value) return; // компонент уже прибрано
  const box = canvas.value.getBoundingClientRect();
  width = Math.max(1, box.width);
  height = Math.max(1, box.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.value.width = Math.ceil(width * dpr);
  canvas.value.height = Math.ceil(height * dpr);
  // Зерно фіксоване для розміру, щоб ресайз не міняв малюнок щокадру
  nodes = growNetwork({ width, height, seed: 11, maxNodes: Math.min(2600, Math.round((width * height) / 450)) });
  paintStill();
  pulses = [];
  draw(0);
}

function spawn() {
  const path = pickRoute(nodes, rng);
  if (!path) return;
  pulses.push({ path, s: 0, speed: 70 + rng() * 90, tail: 70 + rng() * 80, fade: 1 });
}

function draw(dt) {
  const ctx = canvas.value.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(still, 0, 0, width, height);
  if (reduced) return;

  const wanted = Math.min(12, Math.max(4, Math.round(width / 130)));
  if (pulses.length < wanted && rng() < dt * 1.6) spawn();

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  pulses = pulses.filter((p) => {
    p.s += p.speed * dt;
    if (p.s > p.path.length) p.fade -= dt * 2.2; // дійшов до кінчика: гасне
    if (p.fade <= 0) return false;
    const steps = 14;
    let prev = pointAt(p.path, Math.max(0, p.s - p.tail));
    for (let i = 1; i <= steps; i++) {
      const at = pointAt(p.path, Math.max(0, p.s - p.tail * (1 - i / steps)));
      const k = (i / steps) ** 2 * p.fade;
      ctx.strokeStyle = `rgba(190, 247, 214, ${0.75 * k})`;
      ctx.lineWidth = 0.8 + 1.8 * k;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(at.x, at.y);
      ctx.stroke();
      prev = at;
    }
    const head = pointAt(p.path, p.s);
    const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 16);
    glow.addColorStop(0, `rgba(210, 255, 230, ${0.95 * p.fade})`);
    glow.addColorStop(0.3, `rgba(${THREAD}, ${0.4 * p.fade})`);
    glow.addColorStop(1, `rgba(${THREAD}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 16, 0, Math.PI * 2);
    ctx.fill();
    return true;
  });
  ctx.globalCompositeOperation = 'source-over';
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  draw(dt);
  raf = requestAnimationFrame(frame);
}

onMounted(() => {
  if (!canvas.value?.getContext || !document.createElement('canvas').getContext('2d')) return; // jsdom і старі браузери
  rebuild();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(rebuild, 150); });
    observer.observe(canvas.value);
  }
  if (!reduced) raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  clearTimeout(resizeTimer);
  observer?.disconnect();
});
</script>

<template>
  <canvas ref="canvas" class="backdrop" aria-hidden="true" />
</template>

<style scoped>
.backdrop {
  position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none;
  animation: grow-in 1.6s ease-out both;
}
@keyframes grow-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .backdrop { animation: none; } }
</style>
