import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { http } from '../api/http';
import { checkFile } from '../core/attachments';
import { DEFAULT_LAYOUT } from '../core/layout';
import { DEFAULT_THEME } from '../core/theme';
import { TreeNode } from '../core/TreeNode';

// Состояние открытой карты. Источник правды: плоский список nodes
// (так же, как в БД); дерево TreeNode пересобирается из него. Благодаря этому
// Vue отслеживает изменения, а TreeNode остаётся чистым классом без реактивности.
export const useMapEditorStore = defineStore('mapEditor', () => {
  const map = ref(null);
  const nodes = ref([]);
  const boundaries = ref([]); // пунктирні області: { id, label, nodeIds }
  const error = ref('');
  const selectedId = ref(null);

  const root = computed(() => (nodes.value.length ? TreeNode.fromFlat(nodes.value) : null));
  const layout = computed(() => map.value?.layout ?? DEFAULT_LAYOUT);
  const theme = computed(() => map.value?.theme ?? DEFAULT_THEME);
  const selected = computed(() => (selectedId.value && root.value ? root.value.find(selectedId.value) : null));
  // Вкладення лежать усередині рядків вузлів (так їх віддає сервер)
  const attachmentsOf = (nodeId) => nodes.value.find((n) => n.id === nodeId)?.attachments ?? [];
  const selectedAttachments = computed(() => (selectedId.value ? attachmentsOf(selectedId.value) : []));
  const attachmentCounts = computed(() =>
    Object.fromEntries(nodes.value.filter((n) => n.attachments?.length).map((n) => [n.id, n.attachments.length])),
  );
  const base = () => `/maps/${map.value.id}/nodes`;

  let loadToken = 0;

  async function load(mapId) {
    const token = ++loadToken;
    error.value = '';
    map.value = null;
    nodes.value = [];
    boundaries.value = [];
    selectedId.value = null;
    const { map: loaded } = await http.get(`/maps/${mapId}`);
    // Користувач міг уже перейти на іншу вкладку: пізня відповідь не має перезаписати нову карту
    if (token !== loadToken) return;
    const { nodes: rows, boundaries: areas = [], ...rest } = loaded;
    map.value = rest;
    nodes.value = rows;
    boundaries.value = areas;
  }

  // Применяет список { id, parentId, order }, который возвращает сервер
  function applyChanges(changes) {
    for (const { id, parentId, order } of changes) {
      const node = nodes.value.find((n) => n.id === id);
      if (node) Object.assign(node, { parentId, order });
    }
  }

  async function addChild(parentId, text = 'Нова ідея', index) {
    const { node } = await http.post(base(), { parentId, text, index });
    nodes.value.push(node);
    return node;
  }

  const select = (id) => {
    selectedId.value = id;
  };

  // Додає дитину, розгортає згорнутого батька, щоб новий вузол був видимий,
  // і виділяє новий вузол: так можна додавати ідеї одну за одною.
  async function addChildAndSelect(parentId, text) {
    const node = await addChild(parentId, text);
    const parent = nodes.value.find((n) => n.id === parentId);
    if (parent?.collapsed) await patch(parentId, { collapsed: false });
    selectedId.value = node.id;
    return node;
  }

  // Сусід одразу після вузла (як Enter у XMind). У кореня сусідів немає, тому
  // для нього це просто нова дитина.
  async function addSiblingAndSelect(id) {
    const node = root.value?.find(id);
    if (!node || node.isRoot) return addChildAndSelect(id);
    const parentId = node.parent.id;
    const position = node.parent.children.indexOf(node) + 1;
    const created = await addChild(parentId, undefined, position);
    // сервер вставив вузол і зсунув наступних сусідів, відтворюємо це локально
    const siblings = nodes.value.filter((n) => n.parentId === parentId && n.id !== created.id).sort((a, b) => a.order - b.order);
    siblings.splice(position, 0, created);
    siblings.forEach((n, i) => (n.order = i));
    selectedId.value = created.id;
    return created;
  }

  // Оптимістично: на екрані розкладка міняється одразу, а за помилки повертається назад
  async function setLayout(name) {
    const previous = map.value.layout;
    if (previous === name) return;
    map.value.layout = name;
    try {
      await http.patch(`/maps/${map.value.id}`, { layout: name });
    } catch (err) {
      map.value.layout = previous;
      throw err;
    }
  }

  async function renameMap(title) {
    const { map: updated } = await http.patch(`/maps/${map.value.id}`, { title });
    map.value.title = updated.title;
  }

  async function setTheme(name) {
    const previous = map.value.theme;
    if (previous === name) return;
    map.value.theme = name;
    try {
      await http.patch(`/maps/${map.value.id}`, { theme: name });
    } catch (err) {
      map.value.theme = previous;
      throw err;
    }
  }

  async function patch(id, data) {
    const { node } = await http.patch(`${base()}/${id}`, data);
    const target = nodes.value.find((n) => n.id === id);
    if (target) Object.assign(target, node);
  }

  const rename = (id, text) => patch(id, { text });

  const toggleCollapsed = (id) => {
    const node = nodes.value.find((n) => n.id === id);
    return patch(id, { collapsed: !node.collapsed });
  };

  async function move(id, parentId, index) {
    const { changes } = await http.post(`${base()}/${id}/move`, { parentId, index });
    applyChanges(changes);
  }

  // Після переміщення в згорнуту гілку розгортаємо її, щоб вузол не зник з очей
  async function moveAndReveal(id, parentId, index) {
    await move(id, parentId, index);
    const parent = nodes.value.find((n) => n.id === parentId);
    if (parent?.collapsed) await patch(parentId, { collapsed: false });
  }

  // Вантажить файли по одному; перша помилка зупиняє решту й піднімається вгору,
  // але вже завантажені лишаються. Повертає кількість успішно завантажених.
  async function uploadAttachments(nodeId, files) {
    const node = nodes.value.find((n) => n.id === nodeId);
    if (!node) return 0;
    node.attachments ??= [];
    let done = 0;
    for (const file of files) {
      const problem = checkFile(file, node.attachments.length);
      if (problem) throw new Error(problem);
      const { attachment } = await http.upload(`${base()}/${nodeId}/attachments`, file);
      node.attachments.push(attachment);
      done += 1;
    }
    return done;
  }

  async function removeAttachment(nodeId, id) {
    await http.delete(`/maps/${map.value.id}/attachments/${id}`);
    const node = nodes.value.find((n) => n.id === nodeId);
    if (node) node.attachments = node.attachments.filter((a) => a.id !== id);
  }

  // Область з усієї гілки: вузол і всі його нащадки на цей момент
  async function addBoundaryForBranch(id) {
    const branch = root.value?.find(id);
    if (!branch) return null;
    const nodeIds = [...branch.walk()].map((n) => n.id);
    const label = `Область ${boundaries.value.length + 1}`;
    const { boundary } = await http.post(`/maps/${map.value.id}/boundaries`, { label, nodeIds });
    boundaries.value.push(boundary);
    return boundary;
  }

  async function renameBoundary(id, label) {
    const { boundary } = await http.patch(`/maps/${map.value.id}/boundaries/${id}`, { label });
    const target = boundaries.value.find((b) => b.id === id);
    if (target) target.label = boundary.label;
  }

  async function removeBoundary(id) {
    await http.delete(`/maps/${map.value.id}/boundaries/${id}`);
    boundaries.value = boundaries.value.filter((b) => b.id !== id);
  }

  async function remove(id) {
    const { deleted, changes } = await http.delete(`${base()}/${id}`);
    const gone = new Set(deleted);
    nodes.value = nodes.value.filter((n) => !gone.has(n.id));
    if (gone.has(selectedId.value)) selectedId.value = null;
    // так само, як на сервері: видалені вузли зникають з областей, порожні області теж
    boundaries.value = boundaries.value
      .map((b) => ({ ...b, nodeIds: b.nodeIds.filter((n) => !gone.has(n)) }))
      .filter((b) => b.nodeIds.length);
    applyChanges(changes);
  }

  return {
    map, nodes, boundaries, error, selectedId, root, layout, theme, selected,
    load, select, addChild, addChildAndSelect, addSiblingAndSelect, setLayout, setTheme, renameMap, patch, rename, toggleCollapsed, move, moveAndReveal, remove, uploadAttachments, removeAttachment, selectedAttachments, attachmentCounts, addBoundaryForBranch, renameBoundary, removeBoundary,
  };
});
