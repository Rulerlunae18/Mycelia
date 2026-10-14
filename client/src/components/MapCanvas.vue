<script setup>
// Полотно карти. Саме нічого не рахує: розкладку дає Strategy (LayoutContext),
// сцену збирає MapRenderer через Bridge, а компонент лише показує її у SVG
// і відповідає за панорамування та зум.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { dropTarget } from '../core/dragdrop';
import { MapRenderer } from '../core/render/MapRenderer';
import { SvgSceneBackend } from '../core/render/SvgSceneBackend';
import { fitTransform, identity, panBy, zoomAt } from '../core/viewport';

const props = defineProps({
  root: { type: Object, required: true },
  layout: { type: String, default: 'radial' },
  selectedId: { type: String, default: null },
  theme: { type: String, default: 'forest' },
  boundaries: { type: Array, default: () => [] },
  attachmentCounts: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['select', 'toggle', 'move', 'rename', 'add-child', 'add-sibling', 'remove', 'undo', 'redo']);

const renderer = new MapRenderer(new SvgSceneBackend());
const scene = computed(() =>
  renderer.render(props.root, { layout: props.layout, selectedId: props.selectedId, theme: props.theme, boundaries: props.boundaries, attachmentCounts: props.attachmentCounts }),
);

// Фон і акценти полотна дає тема; решта стилів іде через CSS-змінні
const canvasVars = computed(() => {
  const c = scene.value.canvas;
  return {
    '--c-accent': c.accent, '--c-ink': c.ink, '--c-bg': c.background,
    background: `radial-gradient(circle at 1px 1px, ${c.dot} 1px, transparent 0) 0 0 / 24px 24px, ${c.background}`,
  };
});
const nodeVars = (n) => ({
  '--n-fill': n.look.fill, '--n-stroke': n.look.stroke, '--n-sw': n.look.strokeWidth,
  '--n-ink': n.look.textColor, '--n-fs': `${n.look.fontSize}px`, '--n-fw': n.look.fontWeight,
});

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
  if (!host.value) return; // компонент встигли прибрати, поки чекали
  fit();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure);
    observer.observe(host.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

// ---- повний екран: розгортаємо саме полотно, тож правка вузлів і гарячі клавіші працюють як є ----
const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;
const fullscreen = ref(false);

function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement === host.value;
  // Розмір полотна змінився: вписуємо карту, щоб вона не лишилась у куті
  nextTick(fit);
}
function toggleFullscreen() {
  if (!canFullscreen) return;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else host.value?.requestFullscreen?.().catch(() => {});
}
onMounted(() => document.addEventListener?.('fullscreenchange', onFullscreenChange));
onBeforeUnmount(() => document.removeEventListener?.('fullscreenchange', onFullscreenChange));

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

// ---- перетягування вузла ----
// carry: { id, startX, startY, dx, dy (у координатах сцени), active, drop }
const carry = ref(null);
let justDragged = false;
const rectsById = computed(() => new Map(scene.value.nodes.map((n) => [n.id, n.rect])));

function toScene(e) {
  const box = host.value.getBoundingClientRect();
  return {
    x: (e.clientX - box.left - view.value.tx) / view.value.scale,
    y: (e.clientY - box.top - view.value.ty) / view.value.scale,
  };
}

function onNodeDown(e, n) {
  if (e.button !== 0) return;
  e.stopPropagation(); // тягнути вузол не означає панорамувати полотно
  if (n.isRoot) return; // корінь не переміщується; клік по ньому лише вибирає
  carry.value = {
    id: n.id, startX: e.clientX, startY: e.clientY, start: toScene(e), dx: 0, dy: 0, active: false, drop: null,
    svg: e.currentTarget.ownerSVGElement, pointerId: e.pointerId,
  };
  // Указатель захоплюємо лише коли почалось справжнє перетягування: інакше браузер
  // віддасть click і dblclick полотну замість вузла, і вибір та згортання зламаються.
}

function moveCarry(e) {
  const c = carry.value;
  if (!c.active && Math.hypot(e.clientX - c.startX, e.clientY - c.startY) > 5) {
    c.active = true;
    c.svg.setPointerCapture(c.pointerId);
  }
  if (!c.active) return;
  const p = toScene(e);
  c.dx = p.x - c.start.x;
  c.dy = p.y - c.start.y;
  c.drop = dropTarget(props.root, rectsById.value, c.id, p, { axis: props.layout === 'tree' ? 'x' : 'y' });
}

function finishCarry(commit) {
  const c = carry.value;
  carry.value = null;
  if (!c?.active) return;
  justDragged = true; // браузер зараз пришле click: його ігноруємо
  setTimeout(() => (justDragged = false), 0);
  if (commit && c.drop) emit('move', { id: c.id, parentId: c.drop.parentId, index: c.drop.index });
}

function onNodeClick(id) {
  if (!justDragged) emit('select', id);
  host.value?.focus({ preventScroll: true }); // щоб гарячі клавіші працювали одразу після кліку
}

// Підсвітка цілі: рамка навколо батька або риска між сусідами
const dropMark = computed(() => {
  const d = carry.value?.drop;
  if (!d) return null;
  const r = rectsById.value.get(d.targetId);
  if (d.kind === 'child') return { kind: 'child', x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 };
  const horizontal = props.layout === 'tree'; // у дереві сусіди стоять поруч, риска вертикальна
  if (horizontal) {
    const x = d.kind === 'before' ? r.x - 6 : r.x + r.width + 6;
    return { kind: 'line', x1: x, y1: r.y - 4, x2: x, y2: r.y + r.height + 4 };
  }
  const y = d.kind === 'before' ? r.y - 6 : r.y + r.height + 6;
  return { kind: 'line', x1: r.x - 4, y1: y, x2: r.x + r.width + 4, y2: y };
});

function onPointerMove(e) {
  if (carry.value) return moveCarry(e);
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 3) drag.moved = true;
  if (drag.moved) view.value = panBy(view.value, e.clientX - drag.lastX, e.clientY - drag.lastY);
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
}

function onPointerUp(e) {
  if (carry.value) return finishCarry(e.type === 'pointerup');
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

// ---- правка тексту на полотні ----
// Поле вводу лежить поверх SVG (звичайний HTML-input зручніший за foreignObject:
// працюють IME, виділення, автозаповнення), позицію рахуємо з прямокутника вузла.
const editing = ref(null); // { id, text }
const editBox = computed(() => {
  if (!editing.value) return null;
  const r = rectsById.value.get(editing.value.id);
  if (!r) return null;
  const { tx, ty, scale } = view.value;
  const width = Math.max(r.width * scale, 140);
  return {
    left: `${tx + (r.x + r.width / 2) * scale - width / 2}px`,
    top: `${ty + r.y * scale}px`,
    width: `${width}px`,
    height: `${r.height * scale}px`,
    fontSize: `${Math.min(Math.max(13 * scale, 12), 22)}px`,
  };
});

async function edit(id) {
  const node = props.root.find(id);
  if (!node) return;
  editing.value = { id, text: node.text };
  await nextTick();
  const input = host.value?.querySelector('.editor');
  input?.focus();
  input?.select();
}

function commitEdit() {
  const e = editing.value;
  if (!e) return; // blur після Enter/Esc: уже оброблено
  editing.value = null;
  const text = e.text.trim();
  if (text && text !== props.root.find(e.id)?.text) emit('rename', { id: e.id, text });
  host.value?.focus({ preventScroll: true });
}

function cancelEdit() {
  editing.value = null;
  host.value?.focus({ preventScroll: true });
}

// ---- гарячі клавіші (як у XMind) ----
function onKeydown(e) {
  if (editing.value) return;
  // Скасування і повтор. Беремо фізичну клавішу (code), щоб працювало і на українській розкладці.
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    if (e.code === 'KeyZ') { e.preventDefault(); emit(e.shiftKey ? 'redo' : 'undo'); }
    else if (e.code === 'KeyY') { e.preventDefault(); emit('redo'); }
    return;
  }
  if (e.altKey) return;
  if (e.code === 'KeyF' && !e.shiftKey) { e.preventDefault(); toggleFullscreen(); return; }
  const id = props.selectedId;
  if (e.key === 'Escape') return emit('select', null);
  if (!id) return;
  if (e.key === 'F2') { e.preventDefault(); edit(id); }
  else if (e.key === 'Enter') { e.preventDefault(); emit('add-sibling', id); }
  else if (e.key === 'Tab') { e.preventDefault(); emit('add-child', id); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); emit('remove', id); }
}

const badgeWidth = (count) => String(count).length * 7 + 18;

defineExpose({ fit, edit, toggleFullscreen });
</script>

<template>
  <div ref="host" class="canvas" data-testid="canvas" tabindex="0" :style="canvasVars" @keydown="onKeydown">
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
        <g v-for="b in scene.boundaries" :key="b.id" class="boundary" pointer-events="none">
          <path :d="b.path" :fill="b.look.fill" :stroke="b.look.stroke" />
          <text v-if="b.label" :x="b.labelAt.x" :y="b.labelAt.y" :fill="b.look.labelColor">{{ b.label }}</text>
        </g>

        <path
          v-for="e in scene.edges"
          :key="e.id"
          class="edge"
          :d="e.d"
          :stroke="e.look.stroke"
          :stroke-opacity="e.look.opacity"
          :stroke-width="e.look.width"
        />

        <g
          v-for="n in scene.nodes"
          :key="n.id"
          class="node"
          :class="{ root: n.isRoot, selected: n.selected, folded: n.collapsed, dragging: carry?.active && carry.id === n.id }"
          :transform="`translate(${n.rect.x + (carry?.active && carry.id === n.id ? carry.dx : 0)} ${n.rect.y + (carry?.active && carry.id === n.id ? carry.dy : 0)})`"
          role="button"
          tabindex="-1"
          :aria-label="n.text || 'без тексту'"
          :aria-pressed="n.selected"
          :style="nodeVars(n)"
          :data-node-id="n.id"
          @pointerdown="onNodeDown($event, n)"
          @click.stop="onNodeClick(n.id)"
          @dblclick.stop="emit('toggle', n.id)"
          @keydown.space.prevent="emit('select', n.id)"
        >
          <title>{{ n.text }}</title>
          <rect :width="n.rect.width" :height="n.rect.height" :rx="n.rect.height / 2" />
          <text class="label" :x="n.inset + (n.rect.width - n.inset) / 2" :y="n.rect.height / 2">{{ n.label }}</text>
          <g v-if="n.marks.category" class="mark category" :transform="`translate(${n.inset / 2 + 2} ${n.rect.height / 2})`">
            <title>{{ n.marks.category.label }}</title>
            <circle r="9" :fill="n.marks.category.fill" />
            <text :fill="n.marks.category.ink">{{ n.marks.category.glyph }}</text>
          </g>
          <g v-if="n.marks.priority" class="mark priority" transform="translate(6 -2)">
            <title>{{ n.marks.priority.label }}</title>
            <circle r="8" :fill="n.marks.priority.fill" />
            <text :fill="n.marks.priority.ink">{{ n.marks.priority.glyph }}</text>
          </g>
          <g v-if="n.attachmentCount" class="clip" :transform="`translate(${n.rect.width - 30} ${n.rect.height - 7})`">
            <title>Вкладень: {{ n.attachmentCount }}</title>
            <rect width="30" height="15" rx="7.5" />
            <path d="M8 3.5h3.5l2 2V11H8z" />
            <text x="22" y="8">{{ n.attachmentCount }}</text>
          </g>
          <g v-if="n.hasNote" class="note-mark" :transform="`translate(8 ${n.rect.height - 7})`">
            <title>Є нотатка</title>
            <rect width="16" height="15" rx="4" />
            <path d="M4.5 5h7M4.5 7.7h7M4.5 10.4h4.5" />
          </g>
          <g v-if="n.collapsed" class="badge" :transform="`translate(${n.rect.width - 6} ${-8})`">
            <rect :width="badgeWidth(n.hiddenCount)" height="18" rx="9" />
            <text :x="badgeWidth(n.hiddenCount) / 2" y="9">+{{ n.hiddenCount }}</text>
          </g>
        </g>

        <g v-if="dropMark" class="drop-mark" pointer-events="none">
          <rect v-if="dropMark.kind === 'child'" v-bind="{ x: dropMark.x, y: dropMark.y, width: dropMark.width, height: dropMark.height }" rx="20" />
          <line v-else v-bind="{ x1: dropMark.x1, y1: dropMark.y1, x2: dropMark.x2, y2: dropMark.y2 }" />
        </g>
      </g>
    </svg>

    <input
      v-if="editBox && editing"
      v-model="editing.text"
      class="editor"
      :style="editBox"
      maxlength="2000"
      aria-label="Текст вузла"
      @keydown.enter.prevent.stop="commitEdit"
      @keydown.esc.prevent.stop="cancelEdit"
      @keydown.tab.prevent.stop="commitEdit"
      @keydown.stop
      @pointerdown.stop
      @blur="commitEdit"
    />

    <div class="controls" role="group" aria-label="Масштаб">
      <button class="btn btn-small" aria-label="Зменшити" @click="zoomButton(1 / 1.25)">−</button>
      <button class="btn btn-small" aria-label="Збільшити" @click="zoomButton(1.25)">＋</button>
      <button class="btn btn-small" @click="fit">Вписати</button>
      <button
        v-if="canFullscreen" class="btn btn-small" :aria-pressed="fullscreen"
        :title="fullscreen ? 'Вийти з повного екрана (Esc або F)' : 'На весь екран (F)'"
        @click="toggleFullscreen"
      >{{ fullscreen ? '⤡ Згорнути' : '⛶ На весь екран' }}</button>
    </div>
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  height: clamp(460px, calc(100vh - 300px), 900px);
  border: 1px solid rgba(126, 224, 164, 0.3);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(126, 224, 164, 0.05), 0 24px 60px rgba(0, 0, 0, 0.45);
}
.canvas:fullscreen { height: 100vh; border: 0; border-radius: 0; }
.surface { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; user-select: none; }
.surface:active { cursor: grabbing; }

.boundary path { stroke-width: 2; stroke-dasharray: 9 6; stroke-linecap: round; }
.boundary text { font-size: 12px; font-weight: 700; }
.edge { fill: none; stroke-linecap: round; }

.node { cursor: pointer; outline: none; }
.node rect { fill: var(--n-fill); stroke: var(--n-stroke); stroke-width: var(--n-sw); transition: stroke 0.12s; }
.node .label { fill: var(--n-ink); font-size: var(--n-fs); font-weight: var(--n-fw); text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.node:hover rect, .node:focus-visible rect { stroke: var(--c-accent); }
.clip, .note-mark { pointer-events: none; }
.clip rect { fill: var(--c-bg); stroke: var(--c-accent); stroke-width: 1.2; }
.clip path { fill: none; stroke: var(--c-accent); stroke-width: 1.2; stroke-linejoin: round; }
.note-mark rect { fill: var(--c-bg); stroke: var(--c-accent); stroke-width: 1.2; }
.note-mark path { fill: none; stroke: var(--c-accent); stroke-width: 1.2; stroke-linecap: round; }
.clip text { fill: var(--c-accent); font-size: 10px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
.mark { pointer-events: none; }
.mark text { font-size: 11px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
.priority text { font-size: 10px; }
.node.dragging { opacity: 0.75; cursor: grabbing; pointer-events: none; }
.drop-mark rect { fill: rgba(127, 127, 127, 0.12); stroke: var(--c-accent); stroke-width: 2; stroke-dasharray: 6 4; }
.drop-mark line { stroke: var(--c-accent); stroke-width: 4; stroke-linecap: round; }
.node.folded > rect { stroke-dasharray: 5 3; }

.badge rect { fill: var(--c-bg); stroke: var(--c-accent); stroke-width: 1.2; stroke-dasharray: none; }
.badge text { fill: var(--c-accent); font-size: 12px; font-weight: 700; }

.canvas:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
.editor {
  position: absolute; box-sizing: border-box; padding: 0 14px; text-align: center;
  background: var(--c-bg); color: var(--c-ink); border: 2px solid var(--c-accent); border-radius: 999px; outline: none;
}
.controls {
  position: absolute; right: 12px; bottom: 12px; display: flex; gap: 6px; padding: 6px;
  background: rgba(15, 23, 19, 0.72); backdrop-filter: blur(8px); border: 1px solid var(--line); border-radius: 14px;
}
</style>
