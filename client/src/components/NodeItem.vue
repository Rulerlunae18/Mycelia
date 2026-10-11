<script setup>
// Тимчасове відображення дерева списком. На наступному кроці замінимо
// його на полотно (SVG) з розкладками.
defineProps({ node: { type: Object, required: true } });
</script>

<template>
  <li>
    <span class="dot" :class="{ leaf: node.isLeaf }" />
    <span>{{ node.text }}</span>
    <ul v-if="!node.isLeaf">
      <NodeItem v-for="child in node.children" :key="child.id" :node="child" />
    </ul>
  </li>
</template>

<style scoped>
li { list-style: none; margin: 6px 0; }
ul { margin: 4px 0 0; padding-left: 22px; border-left: 1px dashed var(--border); }
.dot { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--accent); }
.dot.leaf { background: var(--muted); }
</style>
