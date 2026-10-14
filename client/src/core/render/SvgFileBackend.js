// Патерн Bridge: ще одна «реалізація» поруч із SvgSceneBackend. Той самий MapRenderer
// малює карту, а цей бекенд збирає з викликів готовий самодостатній SVG-файл: без CSS-змінних
// і без Vue, з усіма стилями прямо в атрибутах. З нього ж робиться PNG.

const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
const MARGIN = 16; // білий проміжок навколо карти, щоб підписи областей не обрізались

export const escapeXml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

const shorten = (text) => (text.length > 40 ? `${text.slice(0, 39)}…` : text);
const badgeWidth = (count) => String(count).length * 7 + 18;

export class SvgFileBackend {
  begin(bounds, canvas) {
    this.bounds = bounds;
    this.canvas = canvas;
    this.layers = { boundaries: [], edges: [], links: [], nodes: [] };
  }

  drawBoundary({ label, path, labelAt, look }) {
    const text = label
      ? `<text x="${labelAt.x}" y="${labelAt.y}" fill="${escapeXml(look.labelColor)}" font-size="12" font-weight="700">${escapeXml(label)}</text>`
      : '';
    this.layers.boundaries.push(
      `<g><path d="${path}" fill="${escapeXml(look.fill)}" stroke="${escapeXml(look.stroke)}" stroke-width="2" stroke-dasharray="9 6" stroke-linecap="round" />${text}</g>`,
    );
  }

  drawEdge({ path, look }) {
    this.layers.edges.push(
      `<path d="${path}" fill="none" stroke="${escapeXml(look.stroke)}" stroke-opacity="${look.opacity}" stroke-width="${look.width}" stroke-linecap="round" />`,
    );
  }

  drawLink({ d, arrow, label, labelAt, look }) {
    const stroke = escapeXml(look.stroke);
    const parts = [
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${look.width}" stroke-dasharray="7 5" stroke-linecap="round" />`,
      `<path d="${arrow}" fill="${stroke}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" />`,
    ];
    if (label) {
      const w = Math.min(label.length, 40) * 6.4 + 14;
      parts.push(
        `<rect x="${labelAt.x - w / 2}" y="${labelAt.y - 10}" width="${w}" height="20" rx="10" fill="${escapeXml(look.labelBg)}" stroke="${stroke}" stroke-width="1" />`,
        `<text x="${labelAt.x}" y="${labelAt.y}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="${escapeXml(look.labelColor)}">${escapeXml(shorten(label))}</text>`,
      );
    }
    this.layers.links.push(`<g>${parts.join('')}</g>`);
  }

  drawNode(node) {
    const { rect, look, marks, inset } = node;
    const accent = escapeXml(this.canvas.accent);
    const bg = escapeXml(this.canvas.background);
    const parts = [
      `<rect width="${rect.width}" height="${rect.height}" rx="${rect.height / 2}" fill="${escapeXml(look.fill)}" stroke="${escapeXml(look.stroke)}" stroke-width="${look.strokeWidth}" />`,
      `<text x="${inset + (rect.width - inset) / 2}" y="${rect.height / 2}" text-anchor="middle" dominant-baseline="central" fill="${escapeXml(look.textColor)}" font-size="${look.fontSize}" font-weight="${look.fontWeight}">${escapeXml(node.label)}</text>`,
    ];
    if (marks.category) {
      parts.push(
        `<g transform="translate(${inset / 2 + 2} ${rect.height / 2})"><circle r="9" fill="${escapeXml(marks.category.fill)}" /><text text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="${escapeXml(marks.category.ink)}">${escapeXml(marks.category.glyph)}</text></g>`,
      );
    }
    if (marks.priority) {
      parts.push(
        `<g transform="translate(6 -2)"><circle r="8" fill="${escapeXml(marks.priority.fill)}" /><text text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" fill="${escapeXml(marks.priority.ink)}">${escapeXml(marks.priority.glyph)}</text></g>`,
      );
    }
    if (node.attachmentCount) {
      parts.push(
        `<g transform="translate(${rect.width - 30} ${rect.height - 7})"><rect width="30" height="15" rx="7.5" fill="${bg}" stroke="${accent}" stroke-width="1.2" /><path d="M8 3.5h3.5l2 2V11H8z" fill="none" stroke="${accent}" stroke-width="1.2" stroke-linejoin="round" /><text x="22" y="8" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" fill="${accent}">${node.attachmentCount}</text></g>`,
      );
    }
    if (node.hasNote) {
      parts.push(
        `<g transform="translate(8 ${rect.height - 7})"><rect width="16" height="15" rx="4" fill="${bg}" stroke="${accent}" stroke-width="1.2" /><path d="M4.5 5h7M4.5 7.7h7M4.5 10.4h4.5" fill="none" stroke="${accent}" stroke-width="1.2" stroke-linecap="round" /></g>`,
      );
    }
    if (node.collapsed) {
      const w = badgeWidth(node.hiddenCount);
      parts.push(
        `<g transform="translate(${rect.width - 6} -8)"><rect width="${w}" height="18" rx="9" fill="${bg}" stroke="${accent}" stroke-width="1.2" /><text x="${w / 2}" y="9" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="${accent}">+${node.hiddenCount}</text></g>`,
      );
    }
    const dash = node.collapsed ? ' stroke-dasharray="5 3"' : '';
    // штрих згорнутого вузла ставимо на рамку, як у редакторі
    parts[0] = parts[0].replace(' />', `${dash} />`);
    this.layers.nodes.push(
      `<g transform="translate(${rect.x} ${rect.y})" data-node-id="${escapeXml(node.id)}">${parts.join('')}</g>`,
    );
  }

  end() {
    const { width, height } = this.bounds;
    const w = Math.ceil(width + MARGIN * 2);
    const h = Math.ceil(height + MARGIN * 2);
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-MARGIN} ${-MARGIN} ${w} ${h}" font-family="${escapeXml(FONT)}">`,
      `<rect x="${-MARGIN}" y="${-MARGIN}" width="${w}" height="${h}" fill="${escapeXml(this.canvas.background)}" />`,
      ...this.layers.boundaries,
      ...this.layers.edges,
      ...this.layers.links,
      ...this.layers.nodes,
      '</svg>',
    ].join('\n');
  }
}
