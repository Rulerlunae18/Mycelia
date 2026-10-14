import { asText, countNodes, materialize, snapshotBranch } from '../core/clipboard';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { http } from '../api/http';
import { checkFile } from '../core/attachments';
import { History } from '../core/history';
import { DEFAULT_LAYOUT } from '../core/layout';
import { getTheme } from '../core/theme';
import { TreeNode } from '../core/TreeNode';

// Состояние открытой карты. Источник правды: плоский список nodes
// (так же, как в БД); дерево TreeNode пересобирается из него. Благодаря этому
// Vue отслеживает изменения, а TreeNode остаётся чистым классом без реактивности.
export const useMapEditorStore = defineStore('mapEditor', () => {
  const map = ref(null);
  const nodes = ref([]);
  const boundaries = ref([]); // пунктирні області: { id, label, nodeIds }
  const links = ref([]); // зв'язки між вузлами: { id, fromId, toId, label }
  const selectedLinkId = ref(null);
  const error = ref('');
  const selectedId = ref(null);

  // Історія дій (Command). Стор це одержувач: дії нижче створюють команди зі своєю
  // оберненою операцією, а History лише виконує їх і веде стеки скасування/повтору.
  const historyState = ref({ canUndo: false, canRedo: false, undoLabel: '', redoLabel: '' });
  const history = new History({
    onChange: () => {
      historyState.value = {
        canUndo: history.canUndo, canRedo: history.canRedo, undoLabel: history.undoLabel, redoLabel: history.redoLabel,
      };
    },
  });

  const root = computed(() => (nodes.value.length ? TreeNode.fromFlat(nodes.value) : null));
  const layout = computed(() => map.value?.layout ?? DEFAULT_LAYOUT);
  // Невідома назва (старі карти з темою «default») показується як тема за замовчуванням
  const theme = computed(() => getTheme(map.value?.theme).name);
  const selected = computed(() => (selectedId.value && root.value ? root.value.find(selectedId.value) : null));
  // Вкладення лежать усередині рядків вузлів (так їх віддає сервер)
  const attachmentsOf = (nodeId) => nodes.value.find((n) => n.id === nodeId)?.attachments ?? [];
  const selectedAttachments = computed(() => (selectedId.value ? attachmentsOf(selectedId.value) : []));
  const attachmentCounts = computed(() =>
    Object.fromEntries(nodes.value.filter((n) => n.attachments?.length).map((n) => [n.id, n.attachments.length])),
  );
  const base = () => `/maps/${map.value.id}/nodes`;

  // Буфер гілок живе поза картою: після load() він лишається, тож гілку можна
  // скопіювати в одній вкладці і вставити в іншій
  const clipboard = ref(null);
  const clipboardInfo = computed(() => (clipboard.value ? { count: countNodes(clipboard.value), title: clipboard.value.text } : null));

  let loadToken = 0;

  async function load(mapId) {
    const token = ++loadToken;
    error.value = '';
    map.value = null;
    nodes.value = [];
    boundaries.value = [];
    links.value = [];
    selectedId.value = null;
    selectedLinkId.value = null;
    history.clear();
    const { map: loaded } = await http.get(`/maps/${mapId}`);
    // Користувач міг уже перейти на іншу вкладку: пізня відповідь не має перезаписати нову карту
    if (token !== loadToken) return;
    const { nodes: rows, boundaries: areas = [], links: arrows = [], ...rest } = loaded;
    map.value = rest;
    nodes.value = rows;
    boundaries.value = areas;
    links.value = arrows;
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

  // Виділений може бути або вузол, або зв'язок
  const select = (id) => {
    selectedId.value = id;
    selectedLinkId.value = null;
  };
  const selectLink = (id) => {
    selectedLinkId.value = id;
    selectedId.value = null;
  };
  const selectedLink = computed(() => links.value.find((l) => l.id === selectedLinkId.value) ?? null);

  // ---- знімки для команд ----
  const rowOf = (n) => ({
    id: n.id, parentId: n.parentId, text: n.text, collapsed: !!n.collapsed,
    style: n.style ?? null, category: n.category ?? null, priority: n.priority ?? null, note: n.note ?? null, order: n.order,
  });

  // Гілка від батька до дітей (так її приймає сервер при відновленні)
  function branchRows(id) {
    const node = root.value?.find(id);
    if (!node) return [];
    return [...node.walk()].map((n) => rowOf(nodes.value.find((r) => r.id === n.id)));
  }

  const siblingIndex = (id) => {
    const n = root.value?.find(id);
    return n?.parent ? n.parent.children.indexOf(n) : 0;
  };

  // Відновлює вузли з відомими id (скасування видалення, повтор додавання)
  async function restoreRows(rows) {
    const { nodes: created, changes } = await http.post(`${base()}/restore`, { nodes: rows });
    applyChanges(changes.filter((c) => !created.some((n) => n.id === c.id)));
    for (const n of created) {
      const change = changes.find((c) => c.id === n.id);
      nodes.value.push({ ...n, ...(change && { parentId: change.parentId, order: change.order }), attachments: n.attachments ?? [] });
    }
  }

  const record = (cmd) => history.execute(cmd);

  // Додає дитину, розгортає згорнутого батька, щоб новий вузол був видимий,
  // і виділяє новий вузол: так можна додавати ідеї одну за одною.
  async function addChildAndSelect(parentId, text) {
    const parent = nodes.value.find((n) => n.id === parentId);
    const expanded = !!parent?.collapsed;
    let created = null;
    const cmd = {
      kind: 'add',
      rows: null,
      label: 'додавання вузла',
      do: async () => {
        created = await addChild(parentId, text);
        cmd.rows = [rowOf(created)];
        if (expanded) await patchRaw(parentId, { collapsed: false });
      },
      undo: async () => {
        await removeRaw(created.id);
        if (expanded) await patchRaw(parentId, { collapsed: true });
      },
      redo: async () => {
        await restoreRows(cmd.rows);
        if (expanded) await patchRaw(parentId, { collapsed: false });
      },
      focusId: () => created.id,
    };
    await record(cmd);
    selectedId.value = created.id;
    return created;
  }

  // Сусід одразу після вузла (як Enter у XMind). У кореня сусідів немає, тому
  // для нього це просто нова дитина.
  async function addSiblingAndSelect(id) {
    const node = root.value?.find(id);
    if (!node || node.isRoot) return addChildAndSelect(id);
    const parentId = node.parent.id;
    const position = node.parent.children.indexOf(node) + 1;
    let created = null;
    const cmd = {
      kind: 'add',
      rows: null,
      label: 'додавання вузла',
      do: async () => {
        created = await addChild(parentId, undefined, position);
        // сервер вставив вузол і зсунув наступних сусідів, відтворюємо це локально
        const siblings = nodes.value.filter((n) => n.parentId === parentId && n.id !== created.id).sort((a, b) => a.order - b.order);
        siblings.splice(position, 0, created);
        siblings.forEach((n, i) => (n.order = i));
        cmd.rows = [rowOf(created)];
      },
      undo: () => removeRaw(created.id),
      redo: () => restoreRows(cmd.rows),
      focusId: () => created.id,
    };
    await record(cmd);
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

  // Без запису в історію: ним користуються самі команди
  async function patchRaw(id, data) {
    const { node } = await http.patch(`${base()}/${id}`, data);
    const target = nodes.value.find((n) => n.id === id);
    if (target) Object.assign(target, node);
  }

  // Зміна полів вузла як команда: старі значення знімаються до зміни
  function patch(id, data, label = 'зміна вузла') {
    const target = nodes.value.find((n) => n.id === id);
    const before = Object.fromEntries(Object.keys(data).map((k) => [k, target?.[k] ?? (k === 'collapsed' ? false : null)]));
    return record({
      label,
      do: () => patchRaw(id, data),
      undo: () => patchRaw(id, before),
      focusId: () => id,
      // Ім'я щойно доданого вузла входить у саме додавання: одне скасування знімає обидва кроки
      mergeInto: (top) => {
        const onlyText = Object.keys(data).length === 1 && 'text' in data;
        if (!(onlyText && top?.kind === 'add' && top.rows?.[0]?.id === id)) return false;
        top.rows[0].text = data.text;
        return true;
      },
    });
  }

  // Нотатка вузла: розгорнутий опис, що не влазить у сам вузол. Послідовні правки однієї
  // нотатки протягом кількох секунд (автозбереження під час друку) зливаються в один крок історії.
  const NOTE_MERGE_MS = 10000;
  function setNote(id, note) {
    const target = nodes.value.find((n) => n.id === id);
    const after = note && note.trim() ? note : null;
    const before = target?.note ?? null;
    if (!target || after === before) return Promise.resolve();
    const cmd = {
      kind: 'note', id, before, after, at: Date.now(),
      label: 'зміна нотатки',
      do: () => patchRaw(id, { note: cmd.after }),
      undo: () => patchRaw(id, { note: cmd.before }),
      redo: () => patchRaw(id, { note: cmd.after }),
      focusId: () => id,
      mergeInto: (top) => {
        if (!(top?.kind === 'note' && top.id === id && Date.now() - top.at < NOTE_MERGE_MS)) return false;
        top.after = after;
        top.at = Date.now();
        return true;
      },
    };
    return record(cmd);
  }

  const rename = (id, text) => patch(id, { text }, 'зміна тексту');

  const toggleCollapsed = (id) => {
    const node = nodes.value.find((n) => n.id === id);
    return patch(id, { collapsed: !node.collapsed }, node.collapsed ? 'розгортання гілки' : 'згортання гілки');
  };

  async function move(id, parentId, index) {
    const { changes } = await http.post(`${base()}/${id}/move`, { parentId, index });
    applyChanges(changes);
  }

  // Після переміщення в згорнуту гілку розгортаємо її, щоб вузол не зник з очей
  function moveAndReveal(id, parentId, index) {
    const node = nodes.value.find((n) => n.id === id);
    const oldParentId = node.parentId;
    const oldIndex = siblingIndex(id);
    const parent = nodes.value.find((n) => n.id === parentId);
    const reveal = !!parent?.collapsed;
    return record({
      label: 'переміщення вузла',
      do: async () => {
        await move(id, parentId, index);
        if (reveal) await patchRaw(parentId, { collapsed: false });
      },
      undo: async () => {
        await move(id, oldParentId, oldIndex);
        if (reveal) await patchRaw(parentId, { collapsed: true });
      },
      focusId: () => id,
    });
  }

  // Дублює гілку (Prototype на сервері): копія з'являється одразу після оригіналу
  // і виділяється. Вкладення сервер не копіює.
  async function duplicate(id) {
    let rows = [];
    await record({
      label: 'дублювання гілки',
      do: async () => {
        const { nodes: created, changes } = await http.post(`${base()}/${id}/duplicate`);
        // зсув наступних сусідів застосовуємо до того, як з'являться нові вузли
        applyChanges(changes.filter((c) => !created.some((n) => n.id === c.id)));
        for (const n of created) {
          const change = changes.find((c) => c.id === n.id);
          nodes.value.push({ ...n, ...(change && { parentId: change.parentId, order: change.order }), attachments: n.attachments ?? [] });
        }
        rows = created.map((n) => rowOf(nodes.value.find((r) => r.id === n.id)));
      },
      undo: () => removeRaw(rows[0].id),
      redo: () => restoreRows(rows),
      focusId: () => rows[0].id,
    });
    selectedId.value = rows[0].id;
    return nodes.value.find((n) => n.id === rows[0].id);
  }

  // Копіює гілку в буфер (знімок без id). Системний буфер обміну отримує текстовий список.
  function copyBranch(id) {
    const node = root.value?.find(id);
    if (!node) return null;
    clipboard.value = snapshotBranch(node);
    try {
      if (typeof navigator !== 'undefined') navigator.clipboard?.writeText(asText(node)).catch(() => {});
    } catch {
      /* системний буфер недоступний: це не заважає внутрішньому */
    }
    return clipboardInfo.value;
  }

  // Вирізати: копія в буфері + видалення (його можна скасувати, а гілка лишається в буфері)
  async function cutBranch(id) {
    const node = root.value?.find(id);
    if (!node || node.isRoot) return null;
    const info = copyBranch(id);
    await remove(id);
    return info;
  }

  // Вставляє гілку з буфера дитиною вузла (за замовчуванням вибраного або кореня), нові id.
  // Скасування видаляє вставлене. Вкладення й області не переносяться.
  async function pasteBranch(parentId) {
    if (!clipboard.value) throw new Error('Буфер порожній: виділи вузол і натисни Ctrl+C');
    const target = root.value?.find(parentId ?? selectedId.value) ?? root.value;
    const reveal = !!target.collapsed;
    const rows = materialize(clipboard.value, { parentId: target.id, index: target.children.length });
    await record({
      label: 'вставлення гілки',
      do: async () => {
        await restoreRows(rows);
        if (reveal) await patchRaw(target.id, { collapsed: false });
      },
      undo: async () => {
        await removeRaw(rows[0].id);
        if (reveal) await patchRaw(target.id, { collapsed: true });
      },
      focusId: () => rows[0].id,
    });
    selectedId.value = rows[0].id;
    return { count: rows.length, title: rows[0].text };
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

  // Без запису в історію
  async function removeRaw(id) {
    const { deleted, changes } = await http.delete(`${base()}/${id}`);
    const gone = new Set(deleted);
    nodes.value = nodes.value.filter((n) => !gone.has(n.id));
    if (gone.has(selectedId.value)) selectedId.value = null;
    // сервер каскадно прибирає зв'язки видалених вузлів
    links.value = links.value.filter((l) => !gone.has(l.fromId) && !gone.has(l.toId));
    if (selectedLinkId.value && !links.value.some((l) => l.id === selectedLinkId.value)) selectedLinkId.value = null;
    // так само, як на сервері: видалені вузли зникають з областей, порожні області теж
    boundaries.value = boundaries.value
      .map((b) => ({ ...b, nodeIds: b.nodeIds.filter((n) => !gone.has(n)) }))
      .filter((b) => b.nodeIds.length);
    applyChanges(changes);
  }

  // Видалення гілки як команда: знімок гілки робимо до видалення, з нього її і відновлюємо.
  // Вкладення (файли) і приналежність до областей не відновлюються.
  function remove(id) {
    const rows = branchRows(id);
    // зв'язки гілки (в тому числі з вузлами поза нею) повертаємо разом із нею
    const ids = new Set(rows.map((r) => r.id));
    const lost = links.value.filter((l) => ids.has(l.fromId) || ids.has(l.toId)).map(({ fromId, toId, label }) => ({ fromId, toId, label }));
    return record({
      label: 'видалення гілки',
      do: () => removeRaw(id),
      undo: async () => {
        await restoreRows(rows);
        for (const l of lost) await createLinkRaw(l);
      },
      focusId: () => id,
    });
  }

  // ---- зв'язки між вузлами ----
  // Команди звертаються до зв'язку за парою вузлів, а не за id: після скасування
  // видалення сервер видає новий id, а пара лишається тією самою.
  const linksBase = () => `/maps/${map.value.id}/links`;
  const linkOf = (fromId, toId) => links.value.find((l) => l.fromId === fromId && l.toId === toId);

  async function createLinkRaw({ fromId, toId, label = null }) {
    const { link } = await http.post(linksBase(), { fromId, toId, label });
    links.value.push(link);
    return link;
  }

  async function deleteLinkRaw(fromId, toId) {
    const link = linkOf(fromId, toId);
    if (!link) return;
    await http.delete(`${linksBase()}/${link.id}`);
    links.value = links.value.filter((l) => l.id !== link.id);
    if (selectedLinkId.value === link.id) selectedLinkId.value = null;
  }

  async function addLink(fromId, toId, label = null) {
    let created = null;
    await record({
      label: "додавання зв'язку",
      do: async () => { created = await createLinkRaw({ fromId, toId, label }); },
      undo: () => deleteLinkRaw(fromId, toId),
      focusId: () => null,
    });
    selectLink(created.id);
    return created;
  }

  async function setLinkLabel(id, label) {
    const link = links.value.find((l) => l.id === id);
    const after = label && label.trim() ? label.trim() : null;
    if (!link || (link.label ?? null) === after) return;
    const { fromId, toId, label: before } = link;
    const apply = async (value) => {
      const target = linkOf(fromId, toId);
      if (!target) return;
      const { link: saved } = await http.patch(`${linksBase()}/${target.id}`, { label: value });
      target.label = saved.label;
    };
    await record({
      label: "підпис зв'язку",
      do: () => apply(after),
      undo: () => apply(before),
      focusId: () => null,
    });
  }

  async function removeLink(id) {
    const link = links.value.find((l) => l.id === id);
    if (!link) return;
    const { fromId, toId, label } = link;
    await record({
      label: "видалення зв'язку",
      do: () => deleteLinkRaw(fromId, toId),
      undo: () => createLinkRaw({ fromId, toId, label }),
      focusId: () => null,
    });
  }

  // ---- скасування і повтор ----
  async function undo() {
    const cmd = await history.undo();
    if (cmd) selectedId.value = nodes.value.some((n) => n.id === cmd.focusId?.()) ? cmd.focusId() : null;
    return cmd;
  }

  async function redo() {
    const cmd = await history.redo();
    if (cmd) selectedId.value = nodes.value.some((n) => n.id === cmd.focusId?.()) ? cmd.focusId() : null;
    return cmd;
  }

  return {
    map, nodes, boundaries, links, selectedLinkId, selectedLink, selectLink, addLink, setLinkLabel, removeLink, error, selectedId, root, layout, theme, selected,
    load, select, addChild, addChildAndSelect, addSiblingAndSelect, setLayout, setTheme, renameMap, patch, setNote, rename, toggleCollapsed, move, moveAndReveal, duplicate, copyBranch, cutBranch, pasteBranch, clipboardInfo, remove, undo, redo, historyState, uploadAttachments, removeAttachment, selectedAttachments, attachmentCounts, addBoundaryForBranch, renameBoundary, removeBoundary,
  };
});
