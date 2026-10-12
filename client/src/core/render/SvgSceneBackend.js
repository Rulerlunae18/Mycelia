// Бекенд для SVG: не малює сам, а збирає опис сцени (прості дані), який
// Vue-компонент перетворює на <path> і <g>. Так Vue екранує текст сам, а
// інтерактивність (вибір, подвійний клік) лишається звичайними обробниками подій.
export class SvgSceneBackend {
  begin(bounds, canvas) {
    this.scene = { bounds, canvas, edges: [], nodes: [] };
  }

  drawEdge({ fromId, toId, path, depth, look }) {
    this.scene.edges.push({ id: toId, fromId, d: path, depth, look });
  }

  drawNode(node) {
    this.scene.nodes.push({ ...node });
  }

  end() {
    return this.scene;
  }
}
