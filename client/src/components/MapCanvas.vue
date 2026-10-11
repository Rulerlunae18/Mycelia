<script setup>
// Полотно карти. Саме нічого не рахує: розкладку дає Strategy (LayoutContext),
// сцену збирає MapRenderer через Bridge, а компонент лише показує її у SVG
// і відповідає за панорамування та зум.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { MapRenderer } from '../core/render/MapRenderer';
import { SvgSceneBackend } from '../core/render/SvgSceneBackend';
import { fitTransform, identity, panBy, zoomAt } from '../core/viewport';

const props = defineProps({
  root: { type: Object, required: true },
  layout: { type: String, default: 'radial' },
  selectedId: { type: String, default: null },
});
const emit = defineEmits(['select', 'toggle']);

const renderer = new MapRenderer(new SvgSceneBackend());
const scene = computed(() =>
  renderer.render(props.root, { layout: props.layout, selectedId: props.selectedId }),
);

const host = ref(null);
const size = ref({ width: 800, height: 520 });
const view = ref(identity());
const transform = computed(() => `translate(${view.value.tx} ${view.value.ty}) scale(${view.value.scale})`);

function measure() {
  const box = host.value?.getBoundingClientRect();
  if (box && box.width > 0 && box.height > 0) size.value = { width: box.width, height: box.height };
}

function fit() {
  measure();
  view.value = fitTransform(scene.value.bounds, size.value);
}

let observer = null;
onMounted(async () => {
  await nextTick();
  fit();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure);
    observer.observe(host.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

// Нова розкладка змінює розміри карти, тож вписуємо її заново.
// Звичайні правки вигляд не зсувають: карта не стрибає під час редагування.
watch(() => props.layout, () => nextTick(fit));

// ---- панорамування і зум ----
let drag = null;

function onPointerDown(e) {
  if (e.button !== 0) return;
  drag = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
  e.currentTarget.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 3) drag.moved = true;
  if (drag.moved) view.value = panBy(view.value, e.clientX - drag.lastX, e.clientY - drag.lastY);
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
}

function onPointerUp() {
  // Клік по порожньому місцю без перетягування знімає виділення
  if (drag && !drag.moved) emit('select', null);
  drag = null;
}

function onWheel(e) {
  const box = host.value.getBoundingClientRect();
  const delta = Math.max(-100, Math.min(100, e.deltaY));
  view.value = zoomAt(view.value, { x: e.clientX - box.left, y: e.clientY - box.top }, Math.exp(-delta * 0.0015));
}

function zoomButton(factor) {
  view.value = zoomAt(view.value, { x: size.value.width / 2, y: size.value.height / 2 }, factor);
}

const badgeWidth = (count) => String(count).length * 7 + 18;

defineExpose({ fit });
</script>

<template>
  <div ref="host" class="canvas" data-testid="canvas">
    <svg
      class="surface"
      role="group"
      aria-label="Карта думок"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.prevent="onWheel"
    >
      <g :transform="transform">
        <path
          v-for="e in scene.edges"
          :key="e.id"
          class="edge"
          :d="e.d"
          :stroke-width="Math.max(1.4, 3.2 - e.depth * 0.6)"
        />

        <g
          v-for="n in scene.nodes"
          :key="n.id"
          class="node"
          :class="{ root: n.isRoot, selected: n.selected, folded: n.collapsed }"
          :transform="`translate(${n.rect.x} ${n.rect.y})`"
          role="button"
          tabindex="0"
          :aria-label="n.text || 'без тексту'"
          :aria-pressed="n.selected"
          @pointerdown.stop
          @click.stop="emit('select', n.id)"
          @dblclick.stop="emit('toggle', n.id)"
          @keydown.enter.prevent="emit('select', n.id)"
        >
          <title>{{ n.text }}</title>
          <rect :width="n.rect.width" :height="n.rect.height" :rx="n.rect.height / 2" />
          <text :x="n.rect.width / 2" :y="n.rect.height / 2">{{ n.label }}</text>
          <g v-if="n.collapsed" class="badge" :transform="`translate(${n.rect.width - 6} ${-8})`">
            <rect :width="badgeWidth(n.hiddenCount)" height="18" rx="9" />
            <text :x="badgeWidth(n.hiddenCount) / 2" y="9">+{{ n.hiddenCount }}</text>
          </g>
        </g>
      </g>
    </svg>

    <div class="controls" role="group" aria-label="Масштаб">
      <button class="btn btn-small" aria-label="Зменшити" @click="zoomButton(1 / 1.25)">−</button>
      <button class="btn btn-small" aria-label="Збільшити" @click="zoomButton(1.25)">＋</button>
      <button class="btn btn-small" @click="fit">Вписати</button>
    </div>
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  height: clamp(460px, calc(100vh - 240px), 900px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background:
    radial-gradient(circle at 1px 1px, rgba(126, 224, 164, 0.1) 1px, transparent 0) 0 0 / 24px 24px,
    var(--surface);
}
.surface { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; user-select: none; }
.surface:active { cursor: grabbing; }

.edge { fill: none; stroke: var(--accent); stroke-opacity: 0.45; stroke-linecap: round; }

.node { cursor: pointer; outline: none; }
.node rect { fill: var(--surface-2); stroke: var(--border); stroke-width: 1.5; transition: stroke 0.12s, fill 0.12s; }
.node text { fill: var(--text); font-size: 13px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.node:hover rect, .node:focus-visible rect { stroke: var(--accent); }
.node.selected rect { stroke: var(--accent); stroke-width: 3; }
.node.root rect { fill: var(--accent); stroke: var(--accent); }
.node.root text { fill: var(--accent-ink); font-size: 15px; font-weight: 700; }
.node.folded > rect { stroke-dasharray: 5 3; }

.badge rect { fill: var(--bg); stroke: var(--accent); stroke-width: 1.2; stroke-dasharray: none; }
.badge text { fill: var(--accent); font-size: 12px; font-weight: 700; }

.controls { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 6px; }
</style>
