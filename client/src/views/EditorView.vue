<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '../api/http';
import AttachmentPanel from '../components/AttachmentPanel.vue';
import MyceliumBackdrop from '../components/MyceliumBackdrop.vue';
import MapCanvas from '../components/MapCanvas.vue';
import MapTabs from '../components/MapTabs.vue';
import NodeItem from '../components/NodeItem.vue';
import NotePanel from '../components/NotePanel.vue';
import { download, fileName, renderSvg, svgToPng, toMarkdown } from '../core/export';
import { LAYOUTS, LAYOUT_NAMES } from '../core/layout';
import { CATEGORIES, PRIORITIES } from '../core/marks';
import { THEMES, THEME_NAMES } from '../core/theme';
import { useMapEditorStore } from '../stores/mapEditor';
import { useTabsStore } from '../stores/tabs';

const route = useRoute();
const router = useRouter();
const store = useMapEditorStore();
const tabs = useTabsStore();
const error = ref('');
const canvas = ref(null);
const uploading = ref(false);
const linkFrom = ref(null); // режим зв'язку: вузол-початок, поки не вибрано ціль
const notice = ref('');
let noticeTimer = 0;
function say(text) {
  notice.value = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (notice.value = ''), 3500);
}
const nodesWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'вузол' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'вузли' : 'вузлів');
const copyNode = (id = store.selectedId) => {
  const info = store.copyBranch(id);
  if (info) say(`Скопійовано «${info.title || 'без тексту'}»: ${info.count} ${nodesWord(info.count)}`);
};
const cutNode = (id = store.selectedId) => run(async () => {
  const info = await store.cutBranch(id);
  if (info) say(`Вирізано «${info.title || 'без тексту'}»: ${info.count} ${nodesWord(info.count)}. Вставити: Ctrl+V`);
});
const pasteNode = (id = store.selectedId) => run(async () => {
  const done = await store.pasteBranch(id);
  say(`Вставлено «${done.title || 'без тексту'}»: ${done.count} ${nodesWord(done.count)}`);
});

const textOf = (id) => store.root?.find(id)?.text || 'без тексту';
const short = (text) => (text.length > 28 ? `${text.slice(0, 27)}…` : text);

function startLink(id = store.selectedId) {
  if (!id) return;
  linkFrom.value = linkFrom.value === id ? null : id;
}
function pickTarget(id) {
  const from = linkFrom.value;
  if (!from) return;
  if (id === from) { linkFrom.value = null; return; }
  linkFrom.value = null;
  run(() => store.addLink(from, id));
}
function onSelect(id) {
  if (!id) linkFrom.value = null;
  store.select(id);
}

async function openMap(id) {
  linkFrom.value = null;
  error.value = '';
  tabs.ensureLoaded();
  try {
    await store.load(id);
    if (store.map?.id === id) tabs.open(id, store.map.title);
  } catch (err) {
    // Карту видалили або вона чужа: вкладка марна, переходимо до сусідньої
    if (id !== route.params.id) return; // запізніла відповідь про вкладку, яку вже залишили
    if (err instanceof ApiError && err.status === 404) {
      const next = tabs.close(id);
      router.replace(next ? { name: 'editor', params: { id: next } } : { name: 'maps' });
    } else {
      error.value = err.message;
    }
  }
}

onMounted(() => openMap(route.params.id));
// Той самий компонент показує різні карти: перемикання вкладки міняє лише адресу
watch(() => route.params.id, (id) => id && openMap(id));

async function uploadFiles(nodeId, files) {
  uploading.value = true;
  try {
    await run(() => store.uploadAttachments(nodeId, files));
  } finally {
    uploading.value = false;
  }
}

function closeTab(id) {
  const next = tabs.close(id);
  if (id !== route.params.id) return;
  router.push(next ? { name: 'editor', params: { id: next } } : { name: 'maps' });
}

function renameTab({ id, title }) {
  run(async () => {
    await store.renameMap(title);
    tabs.setTitle(id, title);
  });
}

// Експорт: SVG збирає той самий рендерер, що й полотно, але з іншим бекендом (Bridge)
async function exportAs(kind) {
  const title = store.map.title;
  if (kind === 'md') return download(new Blob([toMarkdown(store.root, { links: store.links })], { type: 'text/markdown;charset=utf-8' }), fileName(title, 'md'));
  const svg = renderSvg(store.root, {
    layout: store.layout, theme: store.theme, boundaries: store.boundaries, attachmentCounts: store.attachmentCounts, links: store.links,
  });
  if (kind === 'svg') return download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fileName(title, 'svg'));
  return download(await svgToPng(svg), fileName(title, 'png'));
}

async function run(action) {
  error.value = '';
  try {
    await action();
  } catch (err) {
    error.value = err.message;
  }
}

// Новий вузол одразу відкривається для правки: можна друкувати ідеї підряд
async function addAndEdit(create) {
  await run(async () => {
    const node = await create();
    await nextTick();
    canvas.value?.edit(node.id);
  });
}
const addChild = (id = store.selectedId) => addAndEdit(() => store.addChildAndSelect(id));
const addSibling = (id = store.selectedId) => addAndEdit(() => store.addSiblingAndSelect(id));

function removeSelected(id = store.selectedId) {
  const node = store.root?.find(id);
  if (!node || node.isRoot) return;
  const extra = node.size() - 1;
  const text = node.text || 'без тексту';
  const message = extra > 0 ? `Видалити «${text}» разом з ${extra} вкладеними?` : `Видалити «${text}»?`;
  if (confirm(message)) run(() => store.remove(node.id));
}
</script>

<template>
  <MyceliumBackdrop calm />
  <div class="editor">
    <MapTabs :tabs="tabs.tabs" :active-id="route.params.id" @close="closeTab" @rename="renameTab" />
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>

    <template v-if="store.map">
      <header class="head">
        <h1 class="title">{{ store.map.title }}</h1>
        <p class="count">{{ store.root?.size() }} вузлів</p>
      </header>

      <div class="deck card" role="toolbar" aria-label="Налаштування карти">
        <div class="seg" role="group" aria-label="Розкладка">
          <button
            v-for="name in LAYOUT_NAMES"
            :key="name"
            class="btn btn-small"
            :class="{ active: store.layout === name }"
            :aria-pressed="store.layout === name"
            @click="run(() => store.setLayout(name))"
          >{{ LAYOUTS[name].label }}</button>
        </div>

        <label class="theme">
          <span class="muted">Тема</span>
          <select :value="store.theme" aria-label="Тема" @change="run(() => store.setTheme($event.target.value))">
            <option v-for="name in THEME_NAMES" :key="name" :value="name">{{ THEMES[name].label }}</option>
          </select>
        </label>

        <div class="seg exports" role="group" aria-label="Експорт карти">
          <button class="btn btn-small" title="Зберегти карту як векторну картинку" @click="run(() => exportAs('svg'))">⤓ SVG</button>
          <button class="btn btn-small" title="Зберегти карту як зображення" @click="run(() => exportAs('png'))">⤓ PNG</button>
          <button class="btn btn-small" title="Зберегти структуру карти як текст" @click="run(() => exportAs('md'))">⤓ Markdown</button>
        </div>

        <div class="seg history" role="group" aria-label="Історія">
          <button
            class="btn btn-small" :disabled="!store.historyState.canUndo"
            :title="store.historyState.canUndo ? `Скасувати: ${store.historyState.undoLabel} (Ctrl+Z)` : 'Нічого скасовувати'"
            aria-label="Скасувати" @click="run(() => store.undo())"
          >↶</button>
          <button
            class="btn btn-small" :disabled="!store.historyState.canRedo"
            :title="store.historyState.canRedo ? `Повторити: ${store.historyState.redoLabel} (Ctrl+Shift+Z)` : 'Нічого повторювати'"
            aria-label="Повторити" @click="run(() => store.redo())"
          >↷</button>
        </div>
      </div>

      <div class="pick card" :class="{ idle: !store.selected && !store.selectedLink && !linkFrom }" aria-label="Вибраний вузол">
        <template v-if="linkFrom">
          <span class="chip" :title="textOf(linkFrom)">{{ textOf(linkFrom) }}</span>
          <span class="hintline">→ клацни вузол, до якого веде зв'язок</span>
          <span class="acts"><button class="btn btn-small" @click="linkFrom = null">Скасувати (Esc)</button></span>
        </template>
        <template v-else-if="store.selectedLink">
          <span class="chip" :title="`${textOf(store.selectedLink.fromId)} → ${textOf(store.selectedLink.toId)}`">
            {{ short(textOf(store.selectedLink.fromId)) }} → {{ short(textOf(store.selectedLink.toId)) }}
          </span>
          <input
            :key="store.selectedLink.id" :value="store.selectedLink.label ?? ''" class="link-label" maxlength="120"
            aria-label="Підпис зв'язку" placeholder="Підпис, наприклад «впливає на»"
            @change="run(() => store.setLinkLabel(store.selectedLink.id, $event.target.value))"
            @keydown.stop
          />
          <span class="acts">
            <button class="btn btn-small btn-danger" @click="run(() => store.removeLink(store.selectedLink.id))">✕ Видалити зв'язок</button>
          </span>
        </template>
        <template v-else-if="store.selected">
          <span class="chip" :title="store.selected.text">{{ store.selected.text || 'без тексту' }}</span>
          <select
            :value="store.selected.extra.category ?? ''" aria-label="Категорія"
            @change="run(() => store.patch(store.selectedId, { category: $event.target.value || null }))"
          >
            <option value="">Без категорії</option>
            <option v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.glyph }} {{ c.label }}</option>
          </select>
          <select
            :value="store.selected.extra.priority ?? ''" aria-label="Терміновість"
            @change="run(() => store.patch(store.selectedId, { priority: $event.target.value || null }))"
          >
            <option value="">Без терміновості</option>
            <option v-for="p in PRIORITIES" :key="p.key" :value="p.key">{{ p.glyph }} {{ p.label }}</option>
          </select>
          <span class="acts">
            <button class="btn btn-small" @click="canvas?.edit(store.selectedId)">✎ Текст</button>
            <button class="btn btn-small" @click="addChild()">＋ Вкладений</button>
            <button class="btn btn-small" title="Скопіювати гілку в буфер (Ctrl+C)" @click="copyNode()">⎘ Копіювати</button>
            <button
              class="btn btn-small" :disabled="!store.clipboardInfo"
              :title="store.clipboardInfo ? `Вставити «${store.clipboardInfo.title}» (${store.clipboardInfo.count}) всередину вибраного (Ctrl+V)` : 'Буфер порожній: скопіюй гілку'"
              @click="pasteNode()"
            >⎗ Вставити</button>
            <button v-if="!store.selected.isRoot" class="btn btn-small" title="Копія вузла з усіма вкладеними, одразу після нього" @click="run(() => store.duplicate(store.selectedId))">⧉ Дублювати</button>
            <button class="btn btn-small" title="Стрілка від цього вузла до будь-якого іншого, навіть з іншої гілки (L)" @click="startLink()">↔ Зв'язати</button>
            <button class="btn btn-small" title="Пунктирна область навколо вузла і всієї його гілки" @click="run(() => store.addBoundaryForBranch(store.selectedId))">▢ Обвести</button>
            <button v-if="!store.selected.isRoot" class="btn btn-small btn-danger" @click="removeSelected()">✕ Видалити</button>
          </span>
        </template>
        <span v-else class="hintline">Клацни вузол на карті, щоб змінити його, додати значок, нотатку чи файл.</span>
      </div>

      <MapCanvas
        v-if="store.root"
        ref="canvas"
        :root="store.root"
        :layout="store.layout"
        :theme="store.theme"
        :boundaries="store.boundaries"
        :attachment-counts="store.attachmentCounts"
        :selected-id="store.selectedId"
        :links="store.links"
        :selected-link-id="store.selectedLinkId"
        :link-from="linkFrom"
        @select="onSelect"
        @select-link="store.selectLink"
        @pick="pickTarget"
        @start-link="startLink"
        @cancel-link="linkFrom = null"
        @remove-link="(id) => run(() => store.removeLink(id))"
        @toggle="(id) => run(() => store.toggleCollapsed(id))"
        @rename="({ id, text }) => run(() => store.rename(id, text))"
        @add-child="addChild"
        @add-sibling="addSibling"
        @remove="removeSelected"
        @copy="copyNode"
        @cut="cutNode"
        @paste="pasteNode"
        @undo="run(() => store.undo())"
        @redo="run(() => store.redo())"
        @move="({ id, parentId, index }) => run(() => store.moveAndReveal(id, parentId, index))"
      />
      <p class="hint">
        Колесо миші: масштаб · перетягни фон, щоб посунути карту · подвійний клік по вузлу згортає і розгортає гілку · тягни вузол на середину іншого, щоб зробити його дитиною, або на край, щоб змінити порядок.
        <br />Клавіші: <kbd>Tab</kbd> вкладений · <kbd>Enter</kbd> сусід · <kbd>F2</kbd> текст · <kbd>F</kbd> на весь екран · <kbd>L</kbd> зв'язати з іншим вузлом · <kbd>Delete</kbd> видалити · <kbd>Esc</kbd> зняти виділення · <kbd>Ctrl+C</kbd> <kbd>Ctrl+X</kbd> <kbd>Ctrl+V</kbd> копіювати, вирізати, вставити гілку · <kbd>Ctrl+Z</kbd> скасувати · <kbd>Ctrl+Shift+Z</kbd> повторити.
      </p>

      <div v-if="store.selected && store.map" class="panels">
        <NotePanel
          :node-id="store.selectedId"
          :node-title="store.selected.text"
          :note="store.selected.extra.note ?? ''"
          @save="({ id, note }) => run(() => store.setNote(id, note))"
        />
        <AttachmentPanel
          :map-id="store.map.id"
          :node-title="store.selected.text"
          :attachments="store.selectedAttachments"
          :busy="uploading"
          @upload="(files) => uploadFiles(store.selectedId, files)"
          @remove="(id) => run(() => store.removeAttachment(store.selectedId, id))"
        />
      </div>

      <details v-if="store.boundaries.length" class="card outline" open>
        <summary>Області <span class="muted">{{ store.boundaries.length }}</span></summary>
        <ul class="areas">
          <li v-for="b in store.boundaries" :key="b.id">
            <input
              :value="b.label"
              class="area-name"
              maxlength="120"
              aria-label="Назва області"
              placeholder="Без назви"
              @change="run(() => store.renameBoundary(b.id, $event.target.value))"
            />
            <span class="muted">вузлів: {{ b.nodeIds.length }}</span>
            <button class="btn btn-small btn-danger" :aria-label="`Видалити область ${b.label}`" @click="run(() => store.removeBoundary(b.id))">✕</button>
          </li>
        </ul>
      </details>

      <details v-if="store.links.length" class="card outline" open>
        <summary>Зв'язки <span class="muted">{{ store.links.length }}</span></summary>
        <ul class="areas">
          <li v-for="l in store.links" :key="l.id" :class="{ current: l.id === store.selectedLinkId }">
            <button class="link-ends" :title="`${textOf(l.fromId)} → ${textOf(l.toId)}`" @click="store.selectLink(l.id)">
              {{ short(textOf(l.fromId)) }} → {{ short(textOf(l.toId)) }}
            </button>
            <input
              :value="l.label ?? ''" class="area-name" maxlength="120" aria-label="Підпис зв'язку" placeholder="Без підпису"
              @change="run(() => store.setLinkLabel(l.id, $event.target.value))"
            />
            <button class="btn btn-small btn-danger" :aria-label="`Видалити зв'язок ${textOf(l.fromId)} → ${textOf(l.toId)}`" @click="run(() => store.removeLink(l.id))">✕</button>
          </li>
        </ul>
      </details>

      <details class="card outline">
        <summary>Структура <span class="muted">змінити текст вузлів списком</span></summary>
        <ul class="tree"><NodeItem v-if="store.root" :node="store.root" /></ul>
        <p class="muted note">Клацни на текст, щоб змінити (Enter: зберегти, Esc: скасувати).</p>
      </details>
    </template>
  </div>
</template>

<style scoped>
.editor { position: relative; z-index: 1; padding-bottom: 60px; }

/* ── Заголовок карти ── */
.head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 20px; margin-bottom: 18px; }
.title {
  margin: 0; font-family: var(--serif); font-weight: 600; font-size: clamp(2rem, 4.5vw, 2.9rem); line-height: 1.05;
  color: var(--ink); text-shadow: 0 0 28px rgb(var(--glow-rgb) / 0.22); overflow-wrap: anywhere;
}
.count { margin: 0; font-family: var(--serif); font-style: italic; font-weight: 500; font-size: 1.3rem; color: var(--soft); }

/* ── Панель карти і панель вибраного вузла ── */
.deck, .pick { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; padding: 10px 14px; border-radius: 14px; margin-bottom: 10px; }
.seg { display: inline-flex; gap: 4px; padding: 3px; background: rgb(var(--deep-rgb) / 0.45); border: 1px solid rgb(var(--glow-rgb) / 0.14); border-radius: 12px; }
.seg .btn { border-color: transparent; background: transparent; }
.seg .btn:hover { background: rgb(var(--glow-rgb) / 0.12); }
.seg .btn.active { background: var(--glow); color: var(--accent-ink); box-shadow: 0 0 14px rgb(var(--glow-rgb) / 0.3); }
.theme { display: inline-flex; align-items: center; gap: 8px; font-size: 0.9rem; }
.exports { margin-left: auto; }

.pick { min-height: 54px; }
.pick.idle { background: rgb(var(--panel-rgb) / 0.45); border-style: dashed; }
.hintline { font-family: var(--serif); font-style: italic; font-size: 1.15rem; color: var(--muted); }
.chip {
  max-width: 26ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 14px;
  font-family: var(--serif); font-size: 1.2rem; font-weight: 600; color: var(--ink);
  background: radial-gradient(circle at 20% 50%, rgb(var(--glow-rgb) / 0.2), rgb(var(--deep-rgb) / 0.6));
  border: 1px solid rgb(var(--glow-rgb) / 0.5); border-radius: 999px; box-shadow: 0 0 14px rgb(var(--glow-rgb) / 0.15);
}
.acts { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }

.notice { margin: 0 0 12px; font-family: var(--serif); font-style: italic; font-size: 1.15rem; color: var(--glow); }
.hint { margin: 14px 2px 22px; font-size: 0.85rem; line-height: 1.7; color: var(--muted); }

/* ── Нотатка і вкладення поруч, на вузькому екрані одна під одною ── */
.panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 16px; align-items: start; margin-bottom: 16px; }

/* ── Області та структура ── */
.outline { margin-top: 16px; }
.outline summary { cursor: pointer; font-family: var(--serif); font-size: 1.5rem; font-weight: 600; color: var(--ink); list-style-position: outside; }
.outline summary .muted { margin-left: 8px; font-family: inherit; font-size: 1.1rem; font-style: italic; font-weight: 500; }
.outline summary { display: flex; align-items: baseline; list-style: none; }
.outline summary::-webkit-details-marker { display: none; }
/* «брунька»: закрита порожня, відкрита світиться, як активна вкладка */
.outline summary::before {
  content: ''; flex: none; width: 9px; height: 9px; margin-right: 12px; align-self: center; border-radius: 50%;
  border: 1.5px solid rgb(var(--glow-rgb) / 0.6); background: var(--bg); transition: background 0.25s, box-shadow 0.25s;
}
.outline[open] > summary::before { background: var(--glow); border-color: var(--glow); box-shadow: 0 0 10px var(--glow); }
.areas { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
.areas li { display: flex; align-items: center; gap: 10px; }
.area-name { flex: 1; max-width: 360px; }
.link-label { flex: 1; min-width: 200px; max-width: 360px; }
.link-ends {
  max-width: 34ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 12px; cursor: pointer;
  font-family: var(--serif); font-size: 1.05rem; color: var(--ink); background: rgb(var(--deep-rgb) / 0.5);
  border: 1px solid rgb(var(--glow-rgb) / 0.3); border-radius: 999px;
}
.link-ends:hover, .areas li.current .link-ends { border-color: var(--glow); box-shadow: 0 0 10px rgb(var(--glow-rgb) / 0.25); }
.tree { margin: 12px 0 0; padding: 0; }
.note { margin: 16px 0 0; font-size: 0.875rem; }
</style>
