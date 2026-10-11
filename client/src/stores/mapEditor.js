import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { http } from '../api/http';
import { TreeNode } from '../core/TreeNode';

// Состояние открытой карты. Источник правды: плоский список nodes
// (так же, как в БД); дерево TreeNode пересобирается из него. Благодаря этому
// Vue отслеживает изменения, а TreeNode остаётся чистым классом без реактивности.
export const useMapEditorStore = defineStore('mapEditor', () => {
  const map = ref(null);
  const nodes = ref([]);
  const error = ref('');

  const root = computed(() => (nodes.value.length ? TreeNode.fromFlat(nodes.value) : null));
  const base = () => `/maps/${map.value.id}/nodes`;

  async function load(mapId) {
    error.value = '';
    map.value = null;
    nodes.value = [];
    const { map: loaded } = await http.get(`/maps/${mapId}`);
    const { nodes: rows, ...rest } = loaded;
    map.value = rest;
    nodes.value = rows;
  }

  // Применяет список { id, parentId, order }, который возвращает сервер
  function applyChanges(changes) {
    for (const { id, parentId, order } of changes) {
      const node = nodes.value.find((n) => n.id === id);
      if (node) Object.assign(node, { parentId, order });
    }
  }

  async function addChild(parentId, text = 'Нова ідея') {
    const { node } = await http.post(base(), { parentId, text });
    nodes.value.push(node);
    return node;
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

  async function remove(id) {
    const { deleted, changes } = await http.delete(`${base()}/${id}`);
    const gone = new Set(deleted);
    nodes.value = nodes.value.filter((n) => !gone.has(n.id));
    applyChanges(changes);
  }

  return { map, nodes, error, root, load, addChild, rename, toggleCollapsed, move, remove };
});
