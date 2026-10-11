// Бекенд для SVG: не малює сам, а збирає опис сцени (прості дані), який
// Vue-компонент перетворює на <path> і <g>. Так Vue екранує текст сам, а
// інтерактивність (вибір, подвійний клік) лишається звичайними обробниками подій.
export class SvgSceneBackend {
  begin(bounds) {
    this.scene = { bounds, edges: [], nodes: [] };
  }

  drawEdge({ fromId, toId, path, depth }) {
    this.scene.edges.push({ id: toId, fromId, d: path, depth });
  }

  drawNode(node) {
    this.scene.nodes.push({ ...node });
  }

  end() {
    return this.scene;
  }
}
