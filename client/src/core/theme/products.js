// Абстрактні «продукти» Abstract Factory. Кожна тема створює той самий набір
// продуктів, лише з іншими значеннями, тому решта коду не залежить від теми.

export class NodeStyle {
  constructor({ fill, stroke, strokeWidth, textColor, fontSize, fontWeight }) {
    Object.assign(this, { fill, stroke, strokeWidth, textColor, fontSize, fontWeight });
  }
}

export class EdgeStyle {
  constructor({ stroke, width, opacity }) {
    Object.assign(this, { stroke, width, opacity });
  }
}

// Колір значка: заливка і колір символу на ній
export class MarkStyle {
  constructor({ fill, ink }) {
    Object.assign(this, { fill, ink });
  }
}

// Полотно: фон, точки сітки, акцент (наведення, пунктири), колір тексту поверх фону
export class CanvasStyle {
  constructor({ background, dot, accent, ink }) {
    Object.assign(this, { background, dot, accent, ink });
  }
}
